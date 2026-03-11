# 平台助手整合设计

## 背景

现有两套独立的助手系统融合不好：
1. **ACP/自定义助手**（如 cowork）- 存储在 `acp.customAgents`，在 Guid 页面展示
2. **平台助手**（PlatformAgent）- 从平台下载，只在设置页独立展示，无法在 Guid 页面使用

## 目标

统一为**单一的平台助手体系**：
- 所有助手从平台下载
- 移除内置助手和自定义助手概念
- 复用现有 UI 展示能力（AssistantSelectionArea）

## 设计方案

### 数据模型

直接复用 `AcpBackendConfig`，扩展平台相关字段：

```typescript
// 存储在 acp.customAgents 中的助手配置
interface AgentConfig extends AcpBackendConfig {
  platformVersion: string;      // 平台版本号
  installedAt?: string;         // 安装时间
}
```

**ID 命名规则：**
- 平台助手：直接使用平台的 `agent_id`（如 `platform-docking`、`cowork`）

**文件存储：**
- 规则文件：`assistants/{agentId}.{locale}.md`
- 技能文件：`assistants/{agentId}-skills.{locale}.md`

### API 设计

**GET /api/agents** - 获取助手列表

```typescript
// 返回 AcpBackendConfig[] 格式
[
  {
    id: 'cowork',
    name: 'Cowork',
    nameI18n: { 'zh-CN': 'Cowork', 'en-US': 'Cowork' },
    description: '...',
    descriptionI18n: { 'zh-CN': '...', 'en-US': '...' },
    avatar: 'https://.../cowork.png',
    isPreset: true,
    platformVersion: '1.0.0',
    presetAgentType: 'claude',
    promptsI18n: {
      'zh-CN': ['分析当前项目结构', '自动化构建流程'],
      'en-US': ['Analyze project structure', 'Automate build process']
    },
    status: 'installed',  // installed | update_available | not_installed
    downloadUrl: 'https://.../cowork.zip'
  }
]
```

**GET /api/agents/{id}/package** - 下载助手包

返回 zip 文件，包含：
```
cowork.zip
├── cowork.zh-CN.md        # 规则文件
├── cowork.en-US.md        # 规则文件（可选）
├── cowork-skills.zh-CN.md # 技能文件（可选）
└── cowork-skills.en-US.md # 技能文件（可选）
```

### 下载流程

```
用户点击安装/更新
  ↓
下载 zip 包并解压
  ↓
规则文件写入 assistants/{agentId}.{locale}.md
技能文件写入 assistants/{agentId}-skills.{locale}.md
  ↓
合并配置到 acp.customAgents
  ↓
刷新助手列表
```

### UI 设计

**设置页 - 助手管理：**

```
┌─────────────────────────────────────────────┐
│ 🤖 助手管理                                  │
├─────────────────────────────────────────────┤
│ 已安装                                       │
│   ├── Cowork                    v1.0.0  [●] │
│   │                    [进入对话] [检查更新] │
│   ├── 全国平台对接助手            v1.2.0     │
│   │                    [进入对话] [卸载]     │
├─────────────────────────────────────────────┤
│ 可安装                                       │
│   ├── 问题隐患上报助手    v2.0.0    [安装]   │
│   └── 落查任务上报助手    v1.0.0    [安装]   │
└─────────────────────────────────────────────┘

[●] = 默认启用
```

**Guid 页面 - 助手选择：**
- 复用现有 `AssistantSelectionArea` 组件
- 通过 `isPreset` 过滤已安装的助手
- 零改动

## 改动范围

### 需要修改的文件

| 文件 | 改动说明 |
|------|---------|
| `src/common/types/platformTypes.ts` | 简化类型，复用 AcpBackendConfig |
| `src/process/bridge/platformBridge.ts` | 重写下载逻辑，写入 acp.customAgents |
| `src/process/initStorage.ts` | 移除内置助手初始化，改为首次启动下载默认助手 |
| `src/renderer/pages/settings/AssistantManagement.tsx` | 移除自定义助手相关代码 |
| `src/renderer/pages/settings/PlatformAgentList.tsx` | **删除**，功能合并到助手管理 |

### 需要删除的文件/代码

| 文件/代码 | 说明 |
|----------|------|
| `src/common/presets/assistantPresets.ts` | 不再需要内置预设 |
| `isBuiltin` 字段 | 所有相关代码 |
| `isPlatform` 字段 | 全是平台助手，不需要区分 |
| 自定义助手创建/编辑 UI | 用户不能自建 |

### 保持不变的文件

| 文件 | 说明 |
|------|------|
| `src/renderer/pages/guid/components/AssistantSelectionArea.tsx` | 零改动 |
| `src/renderer/pages/guid/hooks/useGuidAgentSelection.ts` | 零改动，复用现有提示词注入逻辑 |

## 数据迁移

首次启动新版本时：
1. 清理旧的 `builtin-*` 数据
2. 自动从平台下载 cowork（作为默认启用的助手）
3. 清理旧的 `assistants/builtin-*` 文件

## 优势

1. **简单** - 单一助手来源，无概念混淆
2. **可维护** - 减少 50%+ 的助手相关代码
3. **可扩展** - 新助手只需平台配置，无需发版
4. **一致体验** - 所有助手统一的 UI 和交互
