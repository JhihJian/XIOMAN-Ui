/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 平台集成 IPC Bridge
 * Platform Integration IPC Bridge
 */

import { ipcBridge } from '@/common';
import type { NodeCredential, RegisterRequest, RegisterResponse, AuthCheckResponse, PlatformAgent, PlatformNotification, AgentYamlConfig } from '@/common/types/platformTypes';
import { PLATFORM_CONFIG } from '@/common/config/platformConfig';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

// Get credential storage path
function getCredentialPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'platform-credentials.json');
}

// Get agent storage path
function getAgentStoragePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, PLATFORM_CONFIG.agentDirName);
}

// Read credentials from local file
function readCredentials(): NodeCredential | null {
  try {
    const credPath = getCredentialPath();
    if (fs.existsSync(credPath)) {
      const content = fs.readFileSync(credPath, 'utf-8');
      return JSON.parse(content) as NodeCredential;
    }
  } catch (error) {
    console.error('[Platform] Failed to read credentials:', error);
  }
  return null;
}

// Write credentials to local file
function writeCredentials(cred: NodeCredential): void {
  try {
    const credPath = getCredentialPath();
    fs.writeFileSync(credPath, JSON.stringify(cred, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Platform] Failed to write credentials:', error);
    throw error;
  }
}

// Delete credentials file
function deleteCredentials(): void {
  try {
    const credPath = getCredentialPath();
    if (fs.existsSync(credPath)) {
      fs.unlinkSync(credPath);
    }
  } catch (error) {
    console.error('[Platform] Failed to delete credentials:', error);
  }
}

// Build headers with auth token
function buildAuthHeaders(): Record<string, string> {
  const cred = readCredentials();
  if (cred?.token) {
    return { Authorization: `Bearer ${cred.token}` };
  }
  return {};
}

// Generic fetch wrapper for API calls
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; msg?: string }> {
  const url = `${PLATFORM_CONFIG.serverUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(),
        ...options.headers,
      },
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`[Platform] API error (${endpoint}):`, error);
    return { success: false, msg: error instanceof Error ? error.message : 'Network error' };
  }
}

export function initPlatformBridge(): void {
  // Node registration
  ipcBridge.platform.register.provider(async ({ auth_code }) => {
    const result = await fetchApi<RegisterResponse>('/api/nodes/register', {
      method: 'POST',
      body: JSON.stringify({ auth_code } as RegisterRequest),
    });

    if (result.success && result.data) {
      // Save credentials after successful registration
      writeCredentials({
        token: result.data.token,
        token_expires_at: result.data.token_expires_at,
      });
    }

    return result;
  });

  // Auth check
  ipcBridge.platform.authCheck.provider(async () => {
    const result = await fetchApi<AuthCheckResponse>('/api/nodes/auth-check');
    return result;
  });

  // Get stored credentials
  ipcBridge.platform.getCredentials.provider(async () => {
    const cred = readCredentials();
    return { success: true, data: cred };
  });

  // Save credentials
  ipcBridge.platform.saveCredentials.provider(async (cred) => {
    try {
      writeCredentials(cred);
      return { success: true };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : 'Save failed' };
    }
  });

  // Clear credentials
  ipcBridge.platform.clearCredentials.provider(async () => {
    deleteCredentials();
    return { success: true };
  });

  // Get agent list from platform
  ipcBridge.platform.getAgentList.provider(async () => {
    const result = await fetchApi<PlatformAgent[]>('/api/nodes/agents');
    return result;
  });

  // Download and save agent package
  ipcBridge.platform.downloadAgent.provider(async ({ agentId }) => {
    try {
      const response = await fetch(`${PLATFORM_CONFIG.serverUrl}/api/agents/${agentId}/package`, {
        headers: buildAuthHeaders(),
      });

      if (!response.ok) {
        return { success: false, msg: 'Download failed' };
      }

      // Save agent package to local storage
      const buffer = await response.arrayBuffer();
      const agentsPath = getAgentStoragePath();
      const agentPath = path.join(agentsPath, agentId);

      // Ensure directory exists
      if (!fs.existsSync(agentPath)) {
        fs.mkdirSync(agentPath, { recursive: true });
      }

      // Save zip file
      const zipPath = path.join(agentPath, 'package.zip');
      fs.writeFileSync(zipPath, Buffer.from(buffer));

      // TODO: Extract and parse agent.yaml

      return { success: true };
    } catch (error) {
      console.error('[Platform] Download agent error:', error);
      return { success: false, msg: error instanceof Error ? error.message : 'Download failed' };
    }
  });

  // Get installed agent config
  ipcBridge.platform.getInstalledAgent.provider(async ({ agentId }) => {
    try {
      const agentsPath = getAgentStoragePath();
      const yamlPath = path.join(agentsPath, agentId, 'agent.yaml');

      if (!fs.existsSync(yamlPath)) {
        return { success: true, data: null };
      }

      // TODO: Parse YAML file properly
      const content = fs.readFileSync(yamlPath, 'utf-8');

      return {
        success: true,
        data: {
          agent_id: agentId,
          name: agentId,
          description: '',
          rules: content,
          knowledge_files: [],
          tools: [],
        } as AgentYamlConfig,
      };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : 'Read failed' };
    }
  });

  // Get notifications
  ipcBridge.platform.getNotifications.provider(async () => {
    const result = await fetchApi<PlatformNotification[]>('/api/nodes/notifications');
    return result;
  });

  // Mark notification as read
  ipcBridge.platform.markNotificationRead.provider(async ({ notificationId }) => {
    const result = await fetchApi<void>(`/api/nodes/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
    return result;
  });
}
