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
import type { NodeCredential, RegisterResponse, AuthCheckResponse, PlatformAgentConfig, PlatformNotification, AgentYamlConfig } from '@/common/types/platformTypes';
import { PLATFORM_CONFIG } from '@/common/config/platformConfig';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

// Dev mode mock configuration
const IS_DEV = process.env.NODE_ENV === 'development';
const MOCK_AUTH_CODE = 'DEMO-2026';

// Mock data for development
const mockRegisterResponse: RegisterResponse = {
  node_id: 'node-demo-2026-001',
  token: 'mock-jwt-token-xxxxx-yyyyy-zzzzz',
  token_expires_at: '2027-03-11T00:00:00Z',
};

const mockAgents: PlatformAgentConfig[] = [
  {
    id: 'platform-docking',
    name: '全国平台对接助手',
    description: '负责与全国安全生产信息平台进行数据对接，自动同步企业信息、人员信息和安全生产数据。',
    platformVersion: '1.2.0',
    avatar: 'platform-docking.png',
    downloadUrl: 'https://example.com/agents/platform-docking-1.2.0.zip',
    installedAt: '2026-03-05T14:30:00Z',
    status: 'installed',
  },
  {
    id: 'hazard-reporting',
    name: '问题隐患整改信息上报助手',
    description: '用于上报问题隐患的整改情况，包括隐患描述、整改措施、整改进度和完成状态等信息。',
    platformVersion: '2.0.0',
    avatar: 'hazard-reporting.png',
    downloadUrl: 'https://example.com/agents/hazard-reporting-2.0.0.zip',
    installedAt: '2026-02-20T11:00:00Z',
    status: 'update_available',
  },
  {
    id: 'inspection-reporting',
    name: '落查任务结果信息上报助手',
    description: '用于上报落查任务的结果信息，包括任务完成情况、检查结果、发现的问题及处理建议等。',
    platformVersion: '1.0.0',
    avatar: 'inspection-reporting.png',
    downloadUrl: 'https://example.com/agents/inspection-reporting-1.0.0.zip',
    status: 'not_installed',
  },
];

const mockNotifications: PlatformNotification[] = [
  {
    id: 'notif-001',
    title: '平台对接数据更新通知',
    content: '全国平台对接助手有新的数据可接入。系统检测到以下数据更新：\n\n1. 企业基础信息变更：共 3 条\n2. 安全生产许可证更新：共 2 条\n3. 人员资质证书更新：共 5 条\n\n请及时查看并确认数据同步。',
    type: 'update',
    related_agent_id: 'platform-docking',
    created_at: '2026-03-11T09:30:00Z',
    read: false,
  },
  {
    id: 'notif-002',
    title: '问题隐患待反馈通知',
    content: '您有新的问题隐患信息待反馈：\n\n隐患编号：HZ-2026-0032\n隐患类型：设备安全\n隐患等级：一般\n发现时间：2026-03-10 14:20\n发现地点：生产车间A区\n\n隐患描述：发现叉车日常点检记录不完整，部分检查项目未按要求填写。\n\n请于 2026-03-15 前完成整改并上报。',
    type: 'task',
    related_agent_id: 'hazard-reporting',
    created_at: '2026-03-10T15:00:00Z',
    read: false,
  },
  {
    id: 'notif-003',
    title: '落查任务待反馈通知',
    content: '您有新的落查任务信息待反馈：\n\n任务编号：LC-2026-0018\n任务类型：专项检查\n任务来源：上级监管部门\n下发时间：2026-03-09 10:00\n\n任务要求：\n对重点危险源进行全面排查，核实安全管理措施落实情况。\n\n截止时间：2026-03-20\n请尽快完成检查并上报结果。',
    type: 'task',
    related_agent_id: 'inspection-reporting',
    created_at: '2026-03-09T10:30:00Z',
    read: true,
  },
];

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
    // Use mock in dev mode
    if (IS_DEV) {
      console.log('[Platform] Using mock data for register');
      if (auth_code !== MOCK_AUTH_CODE) {
        return { success: false, msg: 'Invalid authorization code' };
      }
      writeCredentials({
        token: mockRegisterResponse.token,
        token_expires_at: mockRegisterResponse.token_expires_at,
      });
      return { success: true, data: mockRegisterResponse };
    }

    const result = await fetchApi<RegisterResponse>('/api/nodes/register', {
      method: 'POST',
      body: JSON.stringify({ auth_code }),
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
    // Use mock in dev mode
    if (IS_DEV) {
      console.log('[Platform] Using mock data for auth-check');
      const cred = readCredentials();
      if (!cred?.token) {
        return { success: false, msg: 'No credentials' };
      }
      return {
        success: true,
        data: {
          valid: true,
          node_id: mockRegisterResponse.node_id,
          expires_at: mockRegisterResponse.token_expires_at,
          status: 'active',
        },
      };
    }

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
    // Use mock in dev mode
    if (IS_DEV) {
      console.log('[Platform] Using mock data for agent list');
      return { success: true, data: mockAgents };
    }

    const result = await fetchApi<PlatformAgentConfig[]>('/api/nodes/agents');
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
    // Use mock in dev mode
    if (IS_DEV) {
      console.log('[Platform] Using mock data for notifications');
      return { success: true, data: mockNotifications };
    }

    const result = await fetchApi<PlatformNotification[]>('/api/nodes/notifications');
    return result;
  });

  // Mark notification as read
  ipcBridge.platform.markNotificationRead.provider(async ({ notificationId }) => {
    // Use mock in dev mode
    if (IS_DEV) {
      console.log('[Platform] Using mock for mark notification read:', notificationId);
      return { success: true };
    }

    const result = await fetchApi<void>(`/api/nodes/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
    return { success: result.success, msg: result.msg };
  });
}
