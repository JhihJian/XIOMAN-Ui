# 全国一体化智能中心 · 客户端平台集成设计

> **版本**：v1.0
> **日期**：2026-03-11
> **基于**：PRD_客户端功能说明_精简版.md

---

## 概述

将 XIOMAN-Ui 客户端改造为"全国一体化智能中心"的终端应用，使其能够：
1. 向中心平台注册并认证
2. 从平台拉取 Agent 列表并下载安装
3. 接收平台通知并跳转到关联 Agent 对话
4. 使用下载的 Agent 定义包进行对话

**原则**：最小改动，复用现有对话能力，接口先用 mock 数据实现。

---

## 设计决策

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 节点注册 | 替换现有登录 | 用授权码替换原有的用户名/密码登录 |
| Agent 列表 | 改造 /settings/agent | 在现有页面基础上改造，只展示平台 Agent |
| Agent 下载 | 下载即安装 | 自动解压、解析、注入，用户无需关心细节 |
| 通知面板 | 右侧抽屉 | 从右侧滑出的 Drawer 组件 |
| 离线模式 | 完全禁用 | 显示离线页面，阻止使用 |
| Mock 数据 | MSW 拦截 | 使用 Mock Service Worker，后续替换只需删除 mock |
| Agent 对话 | 通过 agent_id 关联 | 对话时从本地 yaml 文件读取配置 |

---

## 整体架构

### 启动流程

```
┌─────────────────────────────────────────────────────────────┐
│                        启动流程                              │
├─────────────────────────────────────────────────────────────┤
│  1. 检查本地是否有 Token                                     │
│     ├─ 无 Token → 显示全屏引导页（输入授权码）               │
│     └─ 有 Token → 调用 /api/nodes/auth-check                │
│         ├─ active → 继续启动                                │
│         ├─ disabled → 显示禁用页                            │
│         ├─ expired → 显示全屏引导页（输入授权码）            │
│         └─ 网络错误 → 显示离线页面（完全禁用）               │
│                                                             │
│  2. 拉取 Agent 列表 /api/nodes/agents                        │
│                                                             │
│  3. 拉取通知 /api/nodes/notifications                        │
└─────────────────────────────────────────────────────────────┘
```

### 路由结构

**新增路由：**
- 无独立路由，使用状态控制页面显示

**改造页面：**
- `/settings/agent` - Agent 列表页（从平台拉取）

**状态页面：**
- 全屏引导页（输入授权码）
- 禁用页
- 离线页

---

## 数据模型

### 本地存储（SQLite 新增表）

```typescript
// 节点认证信息
interface NodeCredential {
  token: string;            // 认证凭证
  token_expires_at: string; // 过期时间 ISO 格式
}

// 平台 Agent 信息
interface PlatformAgent {
  agent_id: string;         // 唯一标识
  name: string;             // 显示名称
  description: string;      // 描述
  version: string;          // 版本号
  icon: string;             // 图标 URL
  download_url: string;     // 下载地址
  remote_updated_at: string;// 平台更新时间
  local_installed_at?: string; // 本地安装时间
  local_version?: string;   // 本地已安装版本
  status: 'ready' | 'update_available' | 'not_installed';
}

// 通知
interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'update' | 'task' | 'alert' | 'info';
  related_agent_id: string | null;
  created_at: string;
  read: boolean;
}
```

### Agent 定义包结构（下载解压后）

```
agents/{agent_id}/
├── agent.yaml    # 角色定义、rules
├── tools.yaml    # 可用工具定义
└── knowledge/    # 知识库文件
```

---

## Mock API 设计

使用 MSW 拦截以下 6 个 API：

```typescript
// 1. POST /api/nodes/register - 节点注册
// 请求: { auth_code: string }
// 响应: { node_id, token, token_expires_at }

// 2. GET /api/nodes/auth-check - 权限校验
// 响应: { status: 'active' | 'disabled' | 'expired', message }

// 3. GET /api/nodes/agents - 获取 Agent 列表
// 响应: Agent[]

// 4. GET /api/agents/:id/package - 下载 Agent 包
// 响应: ArrayBuffer (zip 文件)

// 5. GET /api/nodes/notifications - 获取通知列表
// 响应: Notification[]

// 6. PUT /api/nodes/notifications/:id/read - 标记已读
// 响应: { success: true }
```

### Mock 数据

```typescript
// Mock Agent 列表
const mockAgents = [
  {
    agent_id: 'platform-docking',
    name: '全国平台对接助手',
    version: '1.0.0',
    description: '协助完成全国一体化平台数据对接工作',
    status: 'ready'
  },
  {
    agent_id: 'hazard-reporting',
    name: '问题隐患整改信息上报助手',
    version: '1.0.0',
    description: '处理问题隐患信息的上报与整改跟踪',
    status: 'update_available'
  },
  {
    agent_id: 'inspection-reporting',
    name: '落查任务结果信息上报助手',
    version: '1.0.0',
    description: '处理落查任务结果的信息上报',
    status: 'not_installed'
  },
];

// Mock 通知列表
const mockNotifications = [
  {
    id: '1',
    title: '通知平台对接有新的数据可接入',
    content: '中心平台已推送 3 条新数据记录，包括：2026年3月数据报送批次 #20260311、企业信息变更记录 2 条、质量检测报告 1 份。请尽快登录系统完成数据接入处理。',
    type: 'task',
    related_agent_id: 'platform-docking',
    created_at: '2026-03-11T10:30:00Z',
    read: false
  },
  {
    id: '2',
    title: '您有新的问题隐患信息待反馈',
    content: '系统检测到以下问题隐患需要处理：\n\n1. XX省数据完整性问题（优先级：高）\n2. YY市接口响应超时（优先级：中）\n\n请使用问题隐患整改信息上报助手进行反馈处理。',
    type: 'task',
    related_agent_id: 'hazard-reporting',
    created_at: '2026-03-11T09:15:00Z',
    read: false
  },
  {
    id: '3',
    title: '您有新的落查任务信息待反馈',
    content: '您被分配了 2 项新的落查任务：\n\n1. 任务编号：LC-2026-0311-001\n   任务名称：第一季度数据质量核查\n   截止日期：2026年3月15日\n\n2. 任务编号：LC-2026-0311-002\n   任务名称：异常数据专项排查\n   截止日期：2026年3月18日',
    type: 'task',
    related_agent_id: 'inspection-reporting',
    created_at: '2026-03-11T08:00:00Z',
    read: true
  },
];
```

---

## IPC Bridge 设计

新增 `platformBridge.ts` 处理与中心平台相关的所有通信：

```typescript
// src/process/bridge/platformBridge.ts

ipcBridge.platform = {
  // 认证相关
  register: ipc(provider<{ authCode: string }, { nodeId: string; token: string; expiresAt: string }>),
  authCheck: ipc(provider<void, { status: 'active' | 'disabled' | 'expired'; message?: string }>),
  getCredentials: ipc(provider<void, NodeCredential | null>),
  clearCredentials: ipc(provider<void, void>),

  // Agent 管理
  getAgentList: ipc(provider<void, PlatformAgent[]>),
  downloadAgent: ipc(provider<{ agentId: string }, void>),  // 下载并安装
  getInstalledAgent: ipc(provider<{ agentId: string }, AgentYamlConfig | null>),

  // 通知
  getNotifications: ipc(provider<void, Notification[]>),
  markNotificationRead: ipc(provider<{ notificationId: string }, void>),
}

// Agent YAML 配置结构（从 agent.yaml 解析）
interface AgentYamlConfig {
  agent_id: string;
  name: string;
  description: string;
  rules: string;              // System Prompt 内容
  knowledge_files: string[];  // knowledge/ 目录下的文件列表
  tools: ToolDefinition[];    // 从 tools.yaml 读取
}
```

### 预置配置

```typescript
// src/common/config/platformConfig.ts
export const PLATFORM_CONFIG = {
  serverUrl: 'https://platform.example.com', // 预置的平台地址
  // 可通过环境变量覆盖：process.env.PLATFORM_URL
};
```

---

## UI 组件设计

### 1. 全屏引导页（AuthGuidePage）

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    [应用 Logo]                              │
│                                                             │
│              全国一体化智能中心                              │
│                                                             │
│         ┌─────────────────────────────┐                    │
│         │     请输入授权码              │                    │
│         └─────────────────────────────┘                    │
│                      [确认]                                  │
│                                                             │
│              授权码错误提示（如有）                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Agent 列表页（改造 /settings/agent）

```
┌─────────────────────────────────────────────────────────────┐
│  平台助手                                    [刷新] 按钮     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [图标] 全国平台对接助手                    ✓ 已就绪   │   │
│  │        协助完成全国一体化平台数据对接工作              │   │
│  │                                          [进入对话 →]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [图标] 问题隐患整改信息上报助手         ⬆ 有更新     │   │
│  │        处理问题隐患信息的上报与整改跟踪               │   │
│  │                                     [更新] [进入对话]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [图标] 萱查任务结果信息上报助手          + 未安装    │   │
│  │        处理落查任务结果的信息上报                      │   │
│  │                                           [下载安装]   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3. 通知抽屉（NotificationDrawer）

```
┌───────────────────────────────────┐
│  通知                     全部已读 │
├───────────────────────────────────┤
│  ● 通知平台对接有新的数据可接入    │
│    中心平台已推送 3 条新数据记录... │
│    10:30               [进入对话→] │
├───────────────────────────────────┤
│  ● 您有新的问题隐患信息待反馈      │
│    系统检测到以下问题隐患需要...   │
│    09:15               [进入对话→] │
├───────────────────────────────────┤
│  ○ 您有新的落查任务信息待反馈      │
│    您被分配了 2 项新的落查任务...  │
│    08:00               [进入对话→] │
└───────────────────────────────────┘
```

---

## 文件结构

```
src/
├── common/
│   ├── config/
│   │   └── platformConfig.ts          # 预置平台配置
│   └── types/
│       └── platformTypes.ts           # 平台相关类型定义
│
├── process/
│   ├── bridge/
│   │   └── platformBridge.ts          # 新增：平台 API Bridge
│   └── services/
│       └── platform/
│           ├── platformService.ts     # 平台 API 调用服务
│           ├── agentManager.ts        # Agent 下载/安装管理
│           └── index.ts
│
├── renderer/
│   ├── mocks/
│   │   ├── handlers/
│   │   │   ├── auth.ts                # 认证相关 mock
│   │   │   ├── agents.ts              # Agent 相关 mock
│   │   │   └── notifications.ts       # 通知相关 mock
│   │   ├── browser.ts                 # MSW browser setup
│   │   └── data.ts                    # Mock 数据定义
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   └── AuthGuidePage.tsx      # 新增：全屏引导页
│   │   ├── status/
│   │   │   ├── DisabledPage.tsx       # 新增：禁用页
│   │   │   └── OfflinePage.tsx        # 新增：离线页
│   │   └── settings/
│   │       └── AgentSettings.tsx      # 改造：Agent 列表页
│   │
│   └── components/
│       └── NotificationDrawer/
│           ├── index.tsx              # 新增：通知抽屉组件
│           └── NotificationItem.tsx
│
└── agents/                            # 下载的 Agent 存放目录
    ├── platform-docking/
    │   ├── agent.yaml
    │   ├── tools.yaml
    │   └── knowledge/
    ├── hazard-reporting/
    └── inspection-reporting/
```

### 需要修改的现有文件

- `src/renderer/router.tsx` - 调整路由逻辑
- `src/renderer/context/AuthContext.tsx` - 改造认证逻辑
- `src/renderer/components/Titlebar/index.tsx` - 添加通知铃铛
- `src/renderer/pages/settings/AssistantManagement.tsx` - 改造为平台 Agent 列表

---

## 实现顺序

### Phase 1: 基础设施（优先）

1. 创建类型定义 `platformTypes.ts`
2. 创建预置配置 `platformConfig.ts`
3. 设置 MSW mock 服务
4. 创建 `platformBridge.ts`（mock 实现）

### Phase 2: 认证流程

1. 改造 `AuthContext.tsx` - 集成平台认证
2. 创建 `AuthGuidePage.tsx` - 全屏引导页
3. 创建 `DisabledPage.tsx` 和 `OfflinePage.tsx`
4. 修改 `router.tsx` - 调整路由守卫逻辑

### Phase 3: Agent 管理

1. 创建 `platformService.ts` 和 `agentManager.ts`
2. 改造 `AgentSettings.tsx` - 展示平台 Agent 列表
3. 实现 Agent 下载/安装流程
4. 实现 Agent yaml 解析

### Phase 4: 通知系统

1. 创建 `NotificationDrawer` 组件
2. 在 `Titlebar` 添加铃铛图标
3. 实现通知轮询
4. 实现点击通知跳转对话

### Phase 5: 对话集成

1. 改造对话系统，支持通过 agent_id 加载配置
2. 实现从 yaml 读取 System Prompt
3. 实现知识库注入

---

## API 汇总

客户端需要对接的中心平台接口，共 6 个：

| 方法 | 路径 | 用途 | 调用时机 |
|------|------|------|----------|
| POST | /api/nodes/register | 节点注册 | 首次启动/Token 过期 |
| GET | /api/nodes/auth-check | 权限校验 | 每次启动 |
| GET | /api/nodes/agents | 获取 Agent 列表 | 启动时 + 手动刷新 |
| GET | /api/agents/:id/package | 下载 Agent 定义包 | 有新版本时 |
| GET | /api/nodes/notifications | 获取通知列表 | 启动时 + 定时轮询 |
| PUT | /api/nodes/notifications/:id/read | 标记通知已读 | 用户查看通知时 |

---

*文档版本：v1.0 | 2026-03-11*
