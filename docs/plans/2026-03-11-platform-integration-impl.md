# 全国一体化智能中心 · 平台集成实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use summ:executing-plans to implement this plan task-by-task.

**Goal:** 将 XIOMAN-Ui 客户端改造为"全国一体化智能中心"的终端应用，支持授权码认证、平台 Agent 管理、通知系统。

**Architecture:**
- 前端使用 MSW 拦截 API 请求模拟平台响应
- 主进程通过 IPC Bridge 提供平台服务接口
- 认证状态通过 AuthContext 管理，控制页面显示

**Tech Stack:** React, TypeScript, MSW (Mock Service Worker), Arco Design, Electron IPC

**相关文档:** [设计文档](./2026-03-11-platform-integration-design.md)

---

## Phase 1: 基础设施

### Task 1.1: 创建平台类型定义

**Files:**
- Create: `src/common/types/platformTypes.ts`

**Step 1: 创建类型定义文件**

```typescript
// src/common/types/platformTypes.ts

/**
 * 平台相关类型定义
 * Platform-related type definitions
 */

// 节点认证凭证
export interface NodeCredential {
  token: string;
  token_expires_at: string; // ISO 格式
}

// 注册请求参数
export interface RegisterRequest {
  auth_code: string;
}

// 注册响应
export interface RegisterResponse {
  node_id: string;
  token: string;
  token_expires_at: string;
}

// 权限校验响应
export interface AuthCheckResponse {
  status: 'active' | 'disabled' | 'expired';
  message?: string;
}

// 平台 Agent 信息
export interface PlatformAgent {
  agent_id: string;
  name: string;
  description: string;
  version: string;
  icon?: string;
  download_url: string;
  remote_updated_at: string;
  local_installed_at?: string;
  local_version?: string;
  status: 'ready' | 'update_available' | 'not_installed';
}

// 通知
export interface PlatformNotification {
  id: string;
  title: string;
  content: string;
  type: 'update' | 'task' | 'alert' | 'info';
  related_agent_id: string | null;
  created_at: string;
  read: boolean;
}

// Agent YAML 配置
export interface AgentYamlConfig {
  agent_id: string;
  name: string;
  description: string;
  rules: string;
  knowledge_files: string[];
  tools: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// 认证状态
export type PlatformAuthStatus =
  | 'checking'      // 正在校验
  | 'authenticated' // 已认证
  | 'unauthenticated' // 未认证（需要输入授权码）
  | 'disabled'      // 节点被禁用
  | 'offline';      // 离线
```

**Step 2: 提交**

```bash
git add src/common/types/platformTypes.ts
git commit -m "feat(platform): add platform type definitions"
```

---

### Task 1.2: 创建平台配置

**Files:**
- Create: `src/common/config/platformConfig.ts`

**Step 1: 创建配置文件**

```typescript
// src/common/config/platformConfig.ts

/**
 * 平台预置配置
 * Platform preset configuration
 */

export const PLATFORM_CONFIG = {
  // 中心平台地址，可通过环境变量覆盖
  serverUrl: process.env.PLATFORM_URL || 'https://platform.example.com',

  // 通知轮询间隔（毫秒）
  notificationPollInterval: 5 * 60 * 1000, // 5 分钟

  // Agent 存储目录名
  agentDirName: 'agents',
} as const;

/**
 * 获取 Agent 存储路径
 */
export function getAgentStoragePath(basePath: string): string {
  return `${basePath}/${PLATFORM_CONFIG.agentDirName}`;
}
```

**Step 2: 提交**

```bash
git add src/common/config/platformConfig.ts
git commit -m "feat(platform): add platform preset configuration"
```

---

### Task 1.3: 安装 MSW 依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装 MSW**

```bash
bun add msw -D
```

**Step 2: 初始化 MSW（browser 模式）**

```bash
bunx msw init src/renderer/public --save
```

**Step 3: 提交**

```bash
git add package.json bun.lockb src/renderer/public/mockServiceWorker.js
git commit -m "chore: add MSW for API mocking"
```

---

### Task 1.4: 创建 Mock 数据文件

**Files:**
- Create: `src/renderer/mocks/data.ts`

**Step 1: 创建 Mock 数据**

```typescript
// src/renderer/mocks/data.ts

import type { PlatformAgent, PlatformNotification } from '@/common/types/platformTypes';

// Mock Agent 列表
export const mockAgents: PlatformAgent[] = [
  {
    agent_id: 'platform-docking',
    name: '全国平台对接助手',
    description: '协助完成全国一体化平台数据对接工作',
    version: '1.0.0',
    icon: '',
    download_url: '/api/agents/platform-docking/package',
    remote_updated_at: '2026-03-10T10:00:00Z',
    status: 'ready',
    local_installed_at: '2026-03-10T10:00:00Z',
    local_version: '1.0.0',
  },
  {
    agent_id: 'hazard-reporting',
    name: '问题隐患整改信息上报助手',
    description: '处理问题隐患信息的上报与整改跟踪',
    version: '1.1.0',
    icon: '',
    download_url: '/api/agents/hazard-reporting/package',
    remote_updated_at: '2026-03-11T08:00:00Z',
    status: 'update_available',
    local_installed_at: '2026-03-09T10:00:00Z',
    local_version: '1.0.0',
  },
  {
    agent_id: 'inspection-reporting',
    name: '落查任务结果信息上报助手',
    description: '处理落查任务结果的信息上报',
    version: '1.0.0',
    icon: '',
    download_url: '/api/agents/inspection-reporting/package',
    remote_updated_at: '2026-03-11T09:00:00Z',
    status: 'not_installed',
  },
];

// Mock 通知列表
export const mockNotifications: PlatformNotification[] = [
  {
    id: '1',
    title: '通知平台对接有新的数据可接入',
    content:
      '中心平台已推送 3 条新数据记录，包括：2026年3月数据报送批次 #20260311、企业信息变更记录 2 条、质量检测报告 1 份。请尽快登录系统完成数据接入处理。',
    type: 'task',
    related_agent_id: 'platform-docking',
    created_at: '2026-03-11T10:30:00Z',
    read: false,
  },
  {
    id: '2',
    title: '您有新的问题隐患信息待反馈',
    content:
      '系统检测到以下问题隐患需要处理：\n\n1. XX省数据完整性问题（优先级：高）\n2. YY市接口响应超时（优先级：中）\n\n请使用问题隐患整改信息上报助手进行反馈处理。',
    type: 'task',
    related_agent_id: 'hazard-reporting',
    created_at: '2026-03-11T09:15:00Z',
    read: false,
  },
  {
    id: '3',
    title: '您有新的落查任务信息待反馈',
    content:
      '您被分配了 2 项新的落查任务：\n\n1. 任务编号：LC-2026-0311-001\n   任务名称：第一季度数据质量核查\n   截止日期：2026年3月15日\n\n2. 任务编号：LC-2026-0311-002\n   任务名称：异常数据专项排查\n   截止日期：2026年3月18日',
    type: 'task',
    related_agent_id: 'inspection-reporting',
    created_at: '2026-03-11T08:00:00Z',
    read: true,
  },
];

// Mock 授权码（测试用）
export const MOCK_AUTH_CODE = 'DEMO-2026';

// Mock 注册响应
export const mockRegisterResponse = {
  node_id: 'node-001',
  token: 'mock-token-' + Date.now(),
  token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 天后
};
```

**Step 2: 提交**

```bash
git add src/renderer/mocks/data.ts
git commit -m "feat(mocks): add platform mock data"
```

---

### Task 1.5: 创建 Mock handlers

**Files:**
- Create: `src/renderer/mocks/handlers/auth.ts`
- Create: `src/renderer/mocks/handlers/agents.ts`
- Create: `src/renderer/mocks/handlers/notifications.ts`
- Create: `src/renderer/mocks/handlers/index.ts`

**Step 1: 创建认证 handler**

```typescript
// src/renderer/mocks/handlers/auth.ts

import { http, HttpResponse, delay } from 'msw';
import { MOCK_AUTH_CODE, mockRegisterResponse } from '../data';

export const authHandlers = [
  // POST /api/nodes/register - 节点注册
  http.post('/api/nodes/register', async ({ request }) => {
    await delay(500); // 模拟网络延迟

    const body = (await request.json()) as { auth_code: string };

    if (body.auth_code === MOCK_AUTH_CODE) {
      return HttpResponse.json({
        success: true,
        data: mockRegisterResponse,
      });
    }

    return HttpResponse.json(
      {
        success: false,
        message: '授权码无效',
      },
      { status: 401 }
    );
  }),

  // GET /api/nodes/auth-check - 权限校验
  http.get('/api/nodes/auth-check', async ({ request }) => {
    await delay(300);

    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({
        success: false,
        status: 'expired',
        message: '未提供认证凭证',
      });
    }

    // Mock: 所有以 'mock-token' 开头的 token 都视为有效
    const token = authHeader.replace('Bearer ', '');
    if (token.startsWith('mock-token')) {
      return HttpResponse.json({
        success: true,
        status: 'active',
      });
    }

    return HttpResponse.json({
      success: false,
      status: 'expired',
      message: '凭证已过期',
    });
  }),
];
```

**Step 2: 创建 Agent handler**

```typescript
// src/renderer/mocks/handlers/agents.ts

import { http, HttpResponse, delay } from 'msw';
import { mockAgents } from '../data';

export const agentHandlers = [
  // GET /api/nodes/agents - 获取 Agent 列表
  http.get('/api/nodes/agents', async () => {
    await delay(400);
    return HttpResponse.json({
      success: true,
      data: mockAgents,
    });
  }),

  // GET /api/agents/:id/package - 下载 Agent 包
  http.get('/api/agents/:agentId/package', async ({ params }) => {
    await delay(800);

    const { agentId } = params;

    // 返回一个空的 zip 文件（mock）
    // 实际实现中这里返回真实的 agent.yaml 内容
    const mockYamlContent = `
agent_id: ${agentId}
name: Mock Agent
description: This is a mock agent for testing
rules: |
  You are a helpful assistant.
  Follow the user's instructions carefully.
knowledge_files: []
tools: []
`;

    // 使用 base64 编码的空 zip 文件
    const emptyZipBase64 =
      'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';

    return new HttpResponse(atob(emptyZipBase64), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${agentId}.zip"`,
      },
    });
  }),
];
```

**Step 3: 创建通知 handler**

```typescript
// src/renderer/mocks/handlers/notifications.ts

import { http, HttpResponse, delay } from 'msw';
import { mockNotifications } from '../data';

export const notificationHandlers = [
  // GET /api/nodes/notifications - 获取通知列表
  http.get('/api/nodes/notifications', async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      data: mockNotifications,
    });
  }),

  // PUT /api/nodes/notifications/:id/read - 标记已读
  http.put('/api/nodes/notifications/:id/read', async ({ params }) => {
    await delay(200);

    const { id } = params;
    const notification = mockNotifications.find((n) => n.id === id);

    if (notification) {
      notification.read = true;
    }

    return HttpResponse.json({
      success: true,
    });
  }),
];
```

**Step 4: 导出所有 handlers**

```typescript
// src/renderer/mocks/handlers/index.ts

import { authHandlers } from './auth';
import { agentHandlers } from './agents';
import { notificationHandlers } from './notifications';

export const handlers = [...authHandlers, ...agentHandlers, ...notificationHandlers];
```

**Step 5: 提交**

```bash
git add src/renderer/mocks/handlers/
git commit -m "feat(mocks): add platform API handlers"
```

---

### Task 1.6: 配置 MSW browser setup

**Files:**
- Create: `src/renderer/mocks/browser.ts`

**Step 1: 创建 browser setup**

```typescript
// src/renderer/mocks/browser.ts

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/**
 * 启动 MSW worker
 */
export async function startMockService(): Promise<void> {
  // 仅在开发模式或启用 mock 时启动
  const shouldMock = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK === 'true';

  if (!shouldMock) {
    console.log('[MSW] Mock service disabled');
    return;
  }

  try {
    await worker.start({
      onUnhandledRequest: 'bypass', // 未匹配的请求正常发送
    });
    console.log('[MSW] Mock service started');
  } catch (error) {
    console.error('[MSW] Failed to start mock service:', error);
  }
}
```

**Step 2: 提交**

```bash
git add src/renderer/mocks/browser.ts
git commit -m "feat(mocks): add MSW browser setup"
```

---

### Task 1.7: 添加 IPC Bridge 定义

**Files:**
- Modify: `src/common/ipcBridge.ts`（在文件末尾添加）

**Step 1: 添加 platform bridge 定义**

在 `src/common/ipcBridge.ts` 文件末尾的 `channel` 定义之后添加：

```typescript
// ==================== Platform API ====================

import type {
  NodeCredential,
  RegisterRequest,
  RegisterResponse,
  AuthCheckResponse,
  PlatformAgent,
  PlatformNotification,
  AgentYamlConfig,
} from './types/platformTypes';

export const platform = {
  // 认证相关
  register: bridge.buildProvider<IBridgeResponse<RegisterResponse>, RegisterRequest>('platform.register'),
  authCheck: bridge.buildProvider<IBridgeResponse<AuthCheckResponse>, void>('platform.auth-check'),
  getCredentials: bridge.buildProvider<IBridgeResponse<NodeCredential | null>, void>('platform.get-credentials'),
  saveCredentials: bridge.buildProvider<IBridgeResponse, NodeCredential>('platform.save-credentials'),
  clearCredentials: bridge.buildProvider<IBridgeResponse, void>('platform.clear-credentials'),

  // Agent 管理
  getAgentList: bridge.buildProvider<IBridgeResponse<PlatformAgent[]>, void>('platform.get-agent-list'),
  downloadAgent: bridge.buildProvider<IBridgeResponse, { agentId: string }>('platform.download-agent'),
  getInstalledAgent: bridge.buildProvider<IBridgeResponse<AgentYamlConfig | null>, { agentId: string }>('platform.get-installed-agent'),

  // 通知
  getNotifications: bridge.buildProvider<IBridgeResponse<PlatformNotification[]>, void>('platform.get-notifications'),
  markNotificationRead: bridge.buildProvider<IBridgeResponse, { notificationId: string }>('platform.mark-notification-read'),
};
```

**Step 2: 提交**

```bash
git add src/common/ipcBridge.ts
git commit -m "feat(ipc): add platform bridge definitions"
```

---

### Task 1.8: 创建 platformBridge 实现

**Files:**
- Create: `src/process/bridge/platformBridge.ts`
- Modify: `src/process/bridge/index.ts`

**Step 1: 创建 platformBridge**

```typescript
// src/process/bridge/platformBridge.ts

/**
 * 平台集成 IPC Bridge
 * Platform Integration IPC Bridge
 */

import { ipcBridge } from '@/common';
import type {
  NodeCredential,
  RegisterRequest,
  RegisterResponse,
  AuthCheckResponse,
  PlatformAgent,
  PlatformNotification,
  AgentYamlConfig,
} from '@/common/types/platformTypes';
import { PLATFORM_CONFIG } from '@/common/config/platformConfig';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

// 凭证存储文件路径
function getCredentialPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'platform-credentials.json');
}

// 读取凭证
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

// 写入凭证
function writeCredentials(cred: NodeCredential): void {
  try {
    const credPath = getCredentialPath();
    fs.writeFileSync(credPath, JSON.stringify(cred, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Platform] Failed to write credentials:', error);
    throw error;
  }
}

// 删除凭证
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

// 构建带认证的请求头
function buildAuthHeaders(): Record<string, string> {
  const cred = readCredentials();
  if (cred?.token) {
    return { Authorization: `Bearer ${cred.token}` };
  }
  return {};
}

// 通用 fetch 封装
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; message?: string }> {
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
    return { success: false, message: error instanceof Error ? error.message : 'Network error' };
  }
}

export function initPlatformBridge(): void {
  // 注册节点
  ipcBridge.platform.register.provider(async ({ auth_code }) => {
    const result = await fetchApi<RegisterResponse>('/api/nodes/register', {
      method: 'POST',
      body: JSON.stringify({ auth_code } as RegisterRequest),
    });

    if (result.success && result.data) {
      // 保存凭证
      writeCredentials({
        token: result.data.token,
        token_expires_at: result.data.token_expires_at,
      });
    }

    return result;
  });

  // 权限校验
  ipcBridge.platform.authCheck.provider(async () => {
    const result = await fetchApi<AuthCheckResponse>('/api/nodes/auth-check');
    return result;
  });

  // 获取凭证
  ipcBridge.platform.getCredentials.provider(async () => {
    const cred = readCredentials();
    return { success: true, data: cred };
  });

  // 保存凭证
  ipcBridge.platform.saveCredentials.provider(async (cred) => {
    try {
      writeCredentials(cred);
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Save failed' };
    }
  });

  // 清除凭证
  ipcBridge.platform.clearCredentials.provider(async () => {
    deleteCredentials();
    return { success: true };
  });

  // 获取 Agent 列表
  ipcBridge.platform.getAgentList.provider(async () => {
    const result = await fetchApi<PlatformAgent[]>('/api/nodes/agents');
    return result;
  });

  // 下载 Agent
  ipcBridge.platform.downloadAgent.provider(async ({ agentId }) => {
    try {
      const response = await fetch(`${PLATFORM_CONFIG.serverUrl}/api/agents/${agentId}/package`, {
        headers: buildAuthHeaders(),
      });

      if (!response.ok) {
        return { success: false, message: 'Download failed' };
      }

      // 保存 Agent 包到本地
      const buffer = await response.arrayBuffer();
      const agentsPath = getAgentStoragePath();
      const agentPath = path.join(agentsPath, agentId);

      // 确保目录存在
      if (!fs.existsSync(agentPath)) {
        fs.mkdirSync(agentPath, { recursive: true });
      }

      // 保存 zip 文件
      const zipPath = path.join(agentPath, 'package.zip');
      fs.writeFileSync(zipPath, Buffer.from(buffer));

      // TODO: 解压并解析 agent.yaml

      return { success: true };
    } catch (error) {
      console.error('[Platform] Download agent error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Download failed' };
    }
  });

  // 获取已安装的 Agent 配置
  ipcBridge.platform.getInstalledAgent.provider(async ({ agentId }) => {
    try {
      const agentsPath = getAgentStoragePath();
      const yamlPath = path.join(agentsPath, agentId, 'agent.yaml');

      if (!fs.existsSync(yamlPath)) {
        return { success: true, data: null };
      }

      // TODO: 解析 YAML 文件
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
      return { success: false, message: error instanceof Error ? error.message : 'Read failed' };
    }
  });

  // 获取通知列表
  ipcBridge.platform.getNotifications.provider(async () => {
    const result = await fetchApi<PlatformNotification[]>('/api/nodes/notifications');
    return result;
  });

  // 标记通知已读
  ipcBridge.platform.markNotificationRead.provider(async ({ notificationId }) => {
    const result = await fetchApi<void>(`/api/nodes/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
    return result;
  });
}

// 获取 Agent 存储路径
function getAgentStoragePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, PLATFORM_CONFIG.agentDirName);
}
```

**Step 2: 在 index.ts 中注册**

在 `src/process/bridge/index.ts` 中添加：

```typescript
// 在导入区域添加
import { initPlatformBridge } from './platformBridge';

// 在 initAllBridges 函数中添加
export function initAllBridges(): void {
  // ... 现有的 init 调用
  initPlatformBridge(); // 添加这一行
}

// 在导出区域添加
export { initPlatformBridge } from './platformBridge';
```

**Step 3: 提交**

```bash
git add src/process/bridge/platformBridge.ts src/process/bridge/index.ts
git commit -m "feat(bridge): implement platform bridge"
```

---

## Phase 2: 认证流程

### Task 2.1: 创建平台认证 Context

**Files:**
- Create: `src/renderer/context/PlatformAuthContext.tsx`

**Step 1: 创建 PlatformAuthContext**

```typescript
// src/renderer/context/PlatformAuthContext.tsx

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ipcBridge } from '@/common';
import type { PlatformAuthStatus, NodeCredential } from '@/common/types/platformTypes';

interface PlatformAuthContextValue {
  status: PlatformAuthStatus;
  isLoading: boolean;
  error: string | null;
  register: (authCode: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | undefined>(undefined);

export const PlatformAuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<PlatformAuthStatus>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('checking');
    setError(null);

    try {
      // 检查本地是否有凭证
      const credResult = await ipcBridge.platform.getCredentials.invoke();
      if (!credResult.success || !credResult.data) {
        setStatus('unauthenticated');
        return;
      }

      // 校验凭证有效性
      const checkResult = await ipcBridge.platform.authCheck.invoke();
      if (checkResult.success && checkResult.data) {
        const { status: authStatus } = checkResult.data;

        if (authStatus === 'active') {
          setStatus('authenticated');
        } else if (authStatus === 'disabled') {
          setStatus('disabled');
        } else {
          setStatus('unauthenticated');
        }
      } else {
        // 网络错误，离线模式
        if (checkResult.message?.includes('Network') || checkResult.message?.includes('fetch')) {
          setStatus('offline');
        } else {
          setStatus('unauthenticated');
        }
      }
    } catch (err) {
      console.error('[PlatformAuth] Refresh error:', err);
      setStatus('offline');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const register = useCallback(async (authCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await ipcBridge.platform.register.invoke({ auth_code: authCode });

      if (result.success) {
        setStatus('authenticated');
        return { success: true };
      } else {
        const message = result.message || '注册失败';
        setError(message);
        return { success: false, message };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await ipcBridge.platform.clearCredentials.invoke();
    setStatus('unauthenticated');
  }, []);

  // 初始化时检查认证状态
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      status,
      isLoading,
      error,
      register,
      logout,
      refresh,
    }),
    [status, isLoading, error, register, logout, refresh]
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
};

export function usePlatformAuth(): PlatformAuthContextValue {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  }
  return context;
}
```

**Step 2: 提交**

```bash
git add src/renderer/context/PlatformAuthContext.tsx
git commit -m "feat(auth): add platform auth context"
```

---

### Task 2.2: 创建全屏引导页

**Files:**
- Create: `src/renderer/pages/auth/AuthGuidePage.tsx`
- Create: `src/renderer/pages/auth/AuthGuidePage.css`

**Step 1: 创建 AuthGuidePage**

```typescript
// src/renderer/pages/auth/AuthGuidePage.tsx

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Typography } from '@arco-design/web-react';
import { usePlatformAuth } from '@/renderer/context/PlatformAuthContext';
import loginLogo from '@renderer/assets/logos/app.png';
import './AuthGuidePage.css';

const AuthGuidePage: React.FC = () => {
  const { t } = useTranslation();
  const { register, isLoading, error } = usePlatformAuth();
  const [authCode, setAuthCode] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!authCode.trim()) return;
    await register(authCode.trim());
  }, [authCode, register]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        void handleSubmit();
      }
    },
    [handleSubmit, isLoading]
  );

  return (
    <div className="auth-guide-page">
      <div className="auth-guide-page__card">
        <div className="auth-guide-page__header">
          <div className="auth-guide-page__logo">
            <img src={loginLogo} alt="Logo" />
          </div>
          <h1 className="auth-guide-page__title">全国一体化智能中心</h1>
          <p className="auth-guide-page__subtitle">请输入授权码以激活应用</p>
        </div>

        <div className="auth-guide-page__form">
          <Input
            className="auth-guide-page__input"
            placeholder="请输入授权码"
            value={authCode}
            onChange={setAuthCode}
            onKeyDown={handleKeyDown}
            size="large"
            disabled={isLoading}
          />

          <Button
            type="primary"
            size="large"
            className="auth-guide-page__submit"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={!authCode.trim()}
          >
            确认
          </Button>

          {error && (
            <div className="auth-guide-page__error">
              <Typography.Text type="error">{error}</Typography.Text>
            </div>
          )}
        </div>

        <div className="auth-guide-page__footer">
          <Typography.Text type="secondary">
            提示：测试授权码为 DEMO-2026
          </Typography.Text>
        </div>
      </div>
    </div>
  );
};

export default AuthGuidePage;
```

**Step 2: 创建样式文件**

```css
/* src/renderer/pages/auth/AuthGuidePage.css */

.auth-guide-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-guide-page__card {
  background: var(--color-bg-1);
  border-radius: 16px;
  padding: 48px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-guide-page__header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-guide-page__logo {
  margin-bottom: 16px;
}

.auth-guide-page__logo img {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.auth-guide-page__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0 0 8px 0;
}

.auth-guide-page__subtitle {
  font-size: 14px;
  color: var(--color-text-3);
  margin: 0;
}

.auth-guide-page__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-guide-page__input {
  border-radius: 8px;
}

.auth-guide-page__submit {
  border-radius: 8px;
  height: 44px;
  font-size: 16px;
}

.auth-guide-page__error {
  text-align: center;
  padding: 8px;
  background: var(--color-danger-light-1);
  border-radius: 4px;
}

.auth-guide-page__footer {
  margin-top: 24px;
  text-align: center;
}
```

**Step 3: 提交**

```bash
git add src/renderer/pages/auth/
git commit -m "feat(auth): add auth guide page component"
```

---

### Task 2.3: 创建禁用页和离线页

**Files:**
- Create: `src/renderer/pages/status/DisabledPage.tsx`
- Create: `src/renderer/pages/status/OfflinePage.tsx`
- Create: `src/renderer/pages/status/StatusPage.css`

**Step 1: 创建 DisabledPage**

```typescript
// src/renderer/pages/status/DisabledPage.tsx

import React from 'react';
import { Button, Typography } from '@arco-design/web-react';
import { CloseCircle } from '@icon-park/react';
import { usePlatformAuth } from '@/renderer/context/PlatformAuthContext';
import './StatusPage.css';

const DisabledPage: React.FC = () => {
  const { logout } = usePlatformAuth();

  const handleReauth = async () => {
    await logout();
  };

  return (
    <div className="status-page">
      <div className="status-page__content">
        <CloseCircle size={64} color="var(--color-danger-6)" />
        <Typography.Title heading={4}>节点已被禁用</Typography.Title>
        <Typography.Text type="secondary">
          该节点已被管理员禁用，无法继续使用。请联系管理员了解更多信息。
        </Typography.Text>
        <Button type="primary" onClick={handleReauth}>
          重新认证
        </Button>
      </div>
    </div>
  );
};

export default DisabledPage;
```

**Step 2: 创建 OfflinePage**

```typescript
// src/renderer/pages/status/OfflinePage.tsx

import React from 'react';
import { Button, Typography } from '@arco-design/web-react';
import { WifiOff } from '@icon-park/react';
import { usePlatformAuth } from '@/renderer/context/PlatformAuthContext';
import './StatusPage.css';

const OfflinePage: React.FC = () => {
  const { refresh } = usePlatformAuth();

  const handleRetry = async () => {
    await refresh();
  };

  return (
    <div className="status-page">
      <div className="status-page__content">
        <WifiOff size={64} color="var(--color-warning-6)" />
        <Typography.Title heading={4}>无法连接中心平台</Typography.Title>
        <Typography.Text type="secondary">
          网络连接异常，无法连接到中心平台。请检查网络连接后重试。
        </Typography.Text>
        <Button type="primary" onClick={handleRetry}>
          重试连接
        </Button>
      </div>
    </div>
  );
};

export default OfflinePage;
```

**Step 3: 创建样式文件**

```css
/* src/renderer/pages/status/StatusPage.css */

.status-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--color-bg-1);
}

.status-page__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  max-width: 400px;
  padding: 32px;
}

.status-page__content .arco-typography-title {
  margin: 0;
}
```

**Step 4: 提交**

```bash
git add src/renderer/pages/status/
git commit -m "feat(status): add disabled and offline pages"
```

---

### Task 2.4: 改造路由逻辑

**Files:**
- Modify: `src/renderer/main.tsx`
- Modify: `src/renderer/router.tsx`

**Step 1: 修改 main.tsx 添加 Provider**

```typescript
// src/renderer/main.tsx

import React from 'react';
import Layout from './layout';
import Router from './router';
import Sider from './sider';
import { useAuth } from './context/AuthContext';
import { PlatformAuthProvider } from './context/PlatformAuthContext';
import { startMockService } from './mocks/browser';

// 启动 MSW mock 服务（开发模式）
if (import.meta.env.DEV) {
  startMockService().catch(console.error);
}

const Main = () => {
  const { ready } = useAuth();

  if (!ready) {
    return null;
  }

  return (
    <PlatformAuthProvider>
      <Router layout={<Layout sider={<Sider />} />} />
    </PlatformAuthProvider>
  );
};

export default Main;
```

**Step 2: 修改 router.tsx 添加认证守卫**

```typescript
// src/renderer/router.tsx

import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLoader from './components/AppLoader';
import { useAuth } from './context/AuthContext';
import { usePlatformAuth } from './context/PlatformAuthContext';
import Conversation from './pages/conversation';
import Guid from './pages/guid';
import About from './pages/settings/About';
import AgentSettings from './pages/settings/AgentSettings';
import DisplaySettings from './pages/settings/DisplaySettings';
import ModeSettings from './pages/settings/ModeSettings';
import SystemSettings from './pages/settings/SystemSettings';
import ToolsSettings from './pages/settings/ToolsSettings';
import WebuiSettings from './pages/settings/WebuiSettings';
import ComponentsShowcase from './pages/test/ComponentsShowcase';
import AuthGuidePage from './pages/auth/AuthGuidePage';
import DisabledPage from './pages/status/DisabledPage';
import OfflinePage from './pages/status/OfflinePage';

// 原有的 WebUI 认证守卫
const ProtectedLayout: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return React.cloneElement(layout);
};

// 平台认证守卫
const PlatformAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = usePlatformAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status === 'unauthenticated') {
    return <AuthGuidePage />;
  }

  if (status === 'disabled') {
    return <DisabledPage />;
  }

  if (status === 'offline') {
    return <OfflinePage />;
  }

  return <>{children}</>;
};

const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={status === 'authenticated' ? <Navigate to="/guid" replace /> : <AuthGuidePage />} />
        <Route
          element={
            <ProtectedLayout layout={layout}>
              <PlatformAuthGuard>
                <Routes>
                  <Route index element={<Navigate to="/guid" replace />} />
                  <Route path="/guid" element={<Guid />} />
                  <Route path="/conversation/:id" element={<Conversation />} />
                  <Route path="/settings/model" element={<ModeSettings />} />
                  <Route path="/settings/agent" element={<AgentSettings />} />
                  <Route path="/settings/display" element={<DisplaySettings />} />
                  <Route path="/settings/webui" element={<WebuiSettings />} />
                  <Route path="/settings/system" element={<SystemSettings />} />
                  <Route path="/settings/about" element={<About />} />
                  <Route path="/settings/tools" element={<ToolsSettings />} />
                  <Route path="/settings" element={<Navigate to="/settings/model" replace />} />
                  <Route path="/test/components" element={<ComponentsShowcase />} />
                </Routes>
              </PlatformAuthGuard>
            </ProtectedLayout>
          }
        />
        <Route path="*" element={<Navigate to={status === 'authenticated' ? '/guid' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;
```

**Step 3: 提交**

```bash
git add src/renderer/main.tsx src/renderer/router.tsx
git commit -m "feat(router): integrate platform auth guard"
```

---

## Phase 3: Agent 管理

### Task 3.1: 创建 Agent 卡片组件

**Files:**
- Create: `src/renderer/components/PlatformAgentCard/index.tsx`
- Create: `src/renderer/components/PlatformAgentCard/index.module.css`

**Step 1: 创建 PlatformAgentCard**

```typescript
// src/renderer/components/PlatformAgentCard/index.tsx

import React, { useMemo } from 'react';
import { Button, Tag, Typography } from '@arco-design/web-react';
import { Robot, Download, Update, CheckCircle } from '@icon-park/react';
import { useNavigate } from 'react-router-dom';
import type { PlatformAgent } from '@/common/types/platformTypes';
import styles from './index.module.css';

interface PlatformAgentCardProps {
  agent: PlatformAgent;
  onDownload?: (agentId: string) => void;
  downloading?: boolean;
}

const PlatformAgentCard: React.FC<PlatformAgentCardProps> = ({ agent, onDownload, downloading }) => {
  const navigate = useNavigate();

  const statusConfig = useMemo(() => {
    switch (agent.status) {
      case 'ready':
        return { label: '已就绪', color: 'green', icon: <CheckCircle size={14} /> };
      case 'update_available':
        return { label: '有更新', color: 'orange', icon: <Update size={14} /> };
      case 'not_installed':
        return { label: '未安装', color: 'gray', icon: <Download size={14} /> };
      default:
        return { label: '未知', color: 'gray', icon: null };
    }
  }, [agent.status]);

  const handleEnterChat = () => {
    // TODO: 跳转到关联 Agent 的对话
    navigate('/guid', { state: { agentId: agent.agent_id } });
  };

  const handleDownload = () => {
    onDownload?.(agent.agent_id);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.icon}>
          <Robot size={32} />
        </div>
        <div className={styles.info}>
          <Typography.Title heading={6} className={styles.name}>
            {agent.name}
          </Typography.Title>
          <Typography.Text type="secondary" className={styles.version}>
            v{agent.version}
          </Typography.Text>
        </div>
        <Tag color={statusConfig.color} className={styles.status}>
          {statusConfig.icon}
          <span>{statusConfig.label}</span>
        </Tag>
      </div>

      <Typography.Text type="secondary" className={styles.description}>
        {agent.description}
      </Typography.Text>

      <div className={styles.actions}>
        {agent.status === 'not_installed' && (
          <Button type="primary" size="small" onClick={handleDownload} loading={downloading}>
            下载安装
          </Button>
        )}
        {agent.status === 'update_available' && (
          <>
            <Button type="outline" size="small" onClick={handleDownload} loading={downloading}>
              更新
            </Button>
            <Button type="primary" size="small" onClick={handleEnterChat}>
              进入对话
            </Button>
          </>
        )}
        {agent.status === 'ready' && (
          <Button type="primary" size="small" onClick={handleEnterChat}>
            进入对话 →
          </Button>
        )}
      </div>
    </div>
  );
};

export default PlatformAgentCard;
```

**Step 2: 创建样式文件**

```css
/* src/renderer/components/PlatformAgentCard/index.module.css */

.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-1);
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
  transition: all 0.2s;
}

.card:hover {
  border-color: var(--color-primary-6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--color-fill-2);
  border-radius: 8px;
  color: var(--color-primary-6);
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  margin: 0 !important;
  line-height: 1.4;
}

.version {
  font-size: 12px;
}

.status {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.description {
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
```

**Step 3: 提交**

```bash
git add src/renderer/components/PlatformAgentCard/
git commit -m "feat(components): add PlatformAgentCard component"
```

---

### Task 3.2: 改造 AgentSettings 页面

**Files:**
- Modify: `src/renderer/pages/settings/AgentSettings.tsx`
- Create: `src/renderer/pages/settings/PlatformAgentList.tsx`

**Step 1: 创建 PlatformAgentList**

```typescript
// src/renderer/pages/settings/PlatformAgentList.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Message, Spin, Typography } from '@arco-design/web-react';
import { Refresh } from '@icon-park/react';
import { ipcBridge } from '@/common';
import type { PlatformAgent } from '@/common/types/platformTypes';
import PlatformAgentCard from '@/renderer/components/PlatformAgentCard';

const PlatformAgentList: React.FC = () => {
  const [agents, setAgents] = useState<PlatformAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.platform.getAgentList.invoke();
      if (result.success && result.data) {
        setAgents(result.data);
      } else {
        Message.error(result.message || '获取 Agent 列表失败');
      }
    } catch (error) {
      Message.error('获取 Agent 列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDownload = useCallback(async (agentId: string) => {
    setDownloadingId(agentId);
    try {
      const result = await ipcBridge.platform.downloadAgent.invoke({ agentId });
      if (result.success) {
        Message.success('下载成功');
        await fetchAgents(); // 刷新列表
      } else {
        Message.error(result.message || '下载失败');
      }
    } catch (error) {
      Message.error('下载失败');
      console.error(error);
    } finally {
      setDownloadingId(null);
    }
  }, [fetchAgents]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-200px">
        <Spin size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-16px">
      <div className="flex items-center justify-between">
        <Typography.Title heading={5} className="m-0">
          平台助手
        </Typography.Title>
        <Button
          type="text"
          size="small"
          icon={<Refresh size={16} />}
          onClick={fetchAgents}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-12px">
        {agents.map((agent) => (
          <PlatformAgentCard
            key={agent.agent_id}
            agent={agent}
            onDownload={handleDownload}
            downloading={downloadingId === agent.agent_id}
          />
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-32px text-t-secondary">
          暂无可用的助手
        </div>
      )}
    </div>
  );
};

export default PlatformAgentList;
```

**Step 2: 修改 AgentSettings**

```typescript
// src/renderer/pages/settings/AgentSettings.tsx

import React from 'react';
import PlatformAgentList from './PlatformAgentList';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const AgentSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <PlatformAgentList />
    </SettingsPageWrapper>
  );
};

export default AgentSettings;
```

**Step 3: 提交**

```bash
git add src/renderer/pages/settings/AgentSettings.tsx src/renderer/pages/settings/PlatformAgentList.tsx
git commit -m "feat(settings): replace AgentSettings with platform agent list"
```

---

## Phase 4: 通知系统

### Task 4.1: 创建通知抽屉组件

**Files:**
- Create: `src/renderer/components/NotificationDrawer/index.tsx`
- Create: `src/renderer/components/NotificationDrawer/NotificationItem.tsx`
- Create: `src/renderer/components/NotificationDrawer/index.module.css`

**Step 1: 创建 NotificationItem**

```typescript
// src/renderer/components/NotificationDrawer/NotificationItem.tsx

import React, { useMemo } from 'react';
import { Button, Typography } from '@arco-design/web-react';
import { useNavigate } from 'react-router-dom';
import type { PlatformNotification } from '@/common/types/platformTypes';
import styles from './index.module.css';

interface NotificationItemProps {
  notification: PlatformNotification;
  onRead?: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRead }) => {
  const navigate = useNavigate();

  const timeAgo = useMemo(() => {
    const date = new Date(notification.created_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    return `${diffDays} 天前`;
  }, [notification.created_at]);

  const handleEnterChat = () => {
    if (notification.related_agent_id) {
      navigate('/guid', { state: { agentId: notification.related_agent_id } });
    }
    onRead?.(notification.id);
  };

  return (
    <div className={`${styles.item} ${!notification.read ? styles.unread : ''}`}>
      <div className={styles.header}>
        <Typography.Text
          bold={!notification.read}
          className={styles.title}
        >
          {notification.title}
        </Typography.Text>
        <Typography.Text type="secondary" className={styles.time}>
          {timeAgo}
        </Typography.Text>
      </div>

      <Typography.Text type="secondary" className={styles.content}>
        {notification.content}
      </Typography.Text>

      {notification.related_agent_id && (
        <Button
          type="text"
          size="small"
          className={styles.action}
          onClick={handleEnterChat}
        >
          进入对话 →
        </Button>
      )}
    </div>
  );
};

export default NotificationItem;
```

**Step 2: 创建 NotificationDrawer**

```typescript
// src/renderer/components/NotificationDrawer/index.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { Drawer, Button, Spin, Typography, Badge } from '@arco-design/web-react';
import { ipcBridge } from '@/common';
import type { PlatformNotification } from '@/common/types/platformTypes';
import NotificationItem from './NotificationItem';
import styles from './index.module.css';

interface NotificationDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ visible, onClose }) => {
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.platform.getNotifications.invoke();
      if (result.success && result.data) {
        setNotifications(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    await Promise.all(
      unreadIds.map((id) => ipcBridge.platform.markNotificationRead.invoke({ notificationId: id }))
    );
    await fetchNotifications();
  }, [notifications, fetchNotifications]);

  const handleItemRead = useCallback(
    async (id: string) => {
      await ipcBridge.platform.markNotificationRead.invoke({ notificationId: id });
      await fetchNotifications();
    },
    [fetchNotifications]
  );

  useEffect(() => {
    if (visible) {
      void fetchNotifications();
    }
  }, [visible, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Drawer
      title={
        <div className={styles.drawerTitle}>
          <span>通知</span>
          {unreadCount > 0 && (
            <Badge count={unreadCount} className={styles.badge} />
          )}
        </div>
      }
      placement="right"
      width={400}
      visible={visible}
      onClose={onClose}
      footer={
        unreadCount > 0 ? (
          <Button type="text" onClick={handleMarkAllRead}>
            全部标记已读
          </Button>
        ) : null
      }
    >
      {loading ? (
        <div className={styles.loading}>
          <Spin />
        </div>
      ) : notifications.length === 0 ? (
        <div className={styles.empty}>
          <Typography.Text type="secondary">暂无通知</Typography.Text>
        </div>
      ) : (
        <div className={styles.list}>
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={handleItemRead}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
};

export default NotificationDrawer;
```

**Step 3: 创建样式文件**

```css
/* src/renderer/components/NotificationDrawer/index.module.css */

.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  margin-left: 4px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.list {
  display: flex;
  flex-direction: column;
}

.item {
  padding: 16px;
  border-bottom: 1px solid var(--color-border-1);
  transition: background-color 0.2s;
}

.item:hover {
  background-color: var(--color-fill-1);
}

.item.unread {
  background-color: var(--color-primary-light-1);
}

.item.unread:hover {
  background-color: var(--color-primary-light-2);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.title {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.time {
  font-size: 12px;
  flex-shrink: 0;
  margin-left: 8px;
}

.content {
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
}

.action {
  padding: 0;
  height: auto;
  font-size: 13px;
}
```

**Step 4: 提交**

```bash
git add src/renderer/components/NotificationDrawer/
git commit -m "feat(components): add NotificationDrawer component"
```

---

### Task 4.2: 在 Titlebar 添加通知铃铛

**Files:**
- Modify: `src/renderer/components/Titlebar/index.tsx`

**Step 1: 添加通知铃铛**

在 `Titlebar` 组件中添加通知相关代码：

```typescript
// 在导入区域添加
import { Remind } from '@icon-park/react';
import NotificationDrawer from '@/renderer/components/NotificationDrawer';

// 在组件内部添加 state
const [notificationVisible, setNotificationVisible] = useState(false);

// 在渲染区域添加（窗口控制按钮之前）
{isDesktopRuntime && !isMacRuntime && (
  <button
    type="button"
    className="app-titlebar__button"
    onClick={() => setNotificationVisible(true)}
    aria-label="通知"
  >
    <Remind theme="outline" size={18} fill="currentColor" />
  </button>
)}

<NotificationDrawer
  visible={notificationVisible}
  onClose={() => setNotificationVisible(false)}
/>
```

**Step 2: 提交**

```bash
git add src/renderer/components/Titlebar/index.tsx
git commit -m "feat(titlebar): add notification bell icon"
```

---

## Phase 5: 对话集成（简化版）

### Task 5.1: 在 GuidPage 支持 agentId 参数

**Files:**
- Modify: `src/renderer/pages/guid/GuidPage.tsx`

**Step 1: 处理 agentId 状态**

在 `GuidPage` 中添加从 location state 读取 agentId 的逻辑：

```typescript
// 在组件开头添加
const location = useLocation();
const agentIdFromState = (location.state as { agentId?: string })?.agentId;

// 当 agentIdFromState 存在时，自动选中对应的 Agent
useEffect(() => {
  if (agentIdFromState) {
    agentSelection.setSelectedAgentKey(agentIdFromState);
  }
}, [agentIdFromState, agentSelection.setSelectedAgentKey]);
```

**Step 2: 提交**

```bash
git add src/renderer/pages/guid/GuidPage.tsx
git commit -m "feat(guid): support agentId from location state"
```

---

## 最终提交

完成所有任务后，创建一个汇总提交：

```bash
git add -A
git commit -m "feat: implement platform integration MVP

- Add platform authentication with auth code
- Add platform agent list page
- Add notification system with drawer
- Add offline/disabled status pages
- Mock APIs using MSW"
```

---

## 测试指南

### 测试认证流程

1. 启动应用，应该看到全屏引导页
2. 输入错误的授权码，应该显示错误提示
3. 输入 `DEMO-2026`，应该成功认证并进入主界面

### 测试 Agent 管理

1. 进入 `/settings/agent` 页面
2. 应该看到 3 个 Agent 卡片
3. 点击"下载安装"按钮，应该能够下载
4. 点击"进入对话"按钮，应该跳转到首页并选中对应 Agent

### 测试通知系统

1. 点击标题栏的通知铃铛
2. 应该从右侧滑出通知抽屉
3. 应该显示 3 条通知
4. 点击"进入对话"，应该跳转到首页

### 测试离线模式

1. 关闭 MSW 或断开网络
2. 重启应用
3. 应该显示离线页面
4. 点击"重试连接"应该重新检查

---

*计划版本：v1.0 | 2026-03-11*
