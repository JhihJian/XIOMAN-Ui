# 移除非 Claude Agent 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use summ:executing-plans to implement this plan task-by-task.

**Goal:** 移除除 Claude Code 外的所有 agent 对接（Gemini CLI、Qwen Code、Codex、OpenCode、OpenClaw、Nanobot 等），简化代码库。

**Architecture:**
1. 保留 ACP 协议层（Claude Code 使用）
2. 移除独立的 Codex/OpenClaw/Nanobot 实现
3. 简化类型定义，只保留 Claude backend
4. 数据库迁移：将现有非 ACP 对话转为 ACP 类型

**Tech Stack:** TypeScript, Electron, SQLite (better-sqlite3), React

---

## Phase 1: 类型系统简化

### Task 1.1: 简化 ACP Backend 类型

**Files:**
- Modify: `src/types/acpTypes.ts`

**Step 1: 修改 PresetAgentType**

将：
```typescript
export type PresetAgentType = 'gemini' | 'claude' | 'codex' | 'codebuddy' | 'opencode' | 'qwen';
```

改为：
```typescript
export type PresetAgentType = 'claude';
```

**Step 2: 修改 ACP_ROUTED_PRESET_TYPES**

将：
```typescript
export const ACP_ROUTED_PRESET_TYPES: readonly PresetAgentType[] = ['claude', 'codebuddy', 'opencode', 'codex', 'qwen'] as const;
```

改为：
```typescript
export const ACP_ROUTED_PRESET_TYPES: readonly PresetAgentType[] = ['claude'] as const;
```

**Step 3: 简化 AcpBackendAll**

将：
```typescript
export type AcpBackendAll =
  | 'claude'
  | 'gemini'
  | 'qwen'
  | 'iflow'
  | 'codex'
  | 'codebuddy'
  | 'droid'
  | 'goose'
  | 'auggie'
  | 'kimi'
  | 'opencode'
  | 'copilot'
  | 'qoder'
  | 'openclaw-gateway'
  | 'vibe'
  | 'nanobot'
  | 'custom';
```

改为：
```typescript
export type AcpBackendAll = 'claude' | 'custom';
```

**Step 4: 简化 ACP_BACKENDS_ALL 配置**

将整个 `ACP_BACKENDS_ALL` 对象简化为只包含 `claude` 和 `custom`：
```typescript
export const ACP_BACKENDS_ALL: Record<AcpBackendAll, AcpBackendConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    cliCommand: 'claude',
    authRequired: true,
    enabled: true,
    supportsStreaming: false,
  },
  custom: {
    id: 'custom',
    name: 'Custom Agent',
    cliCommand: undefined,
    authRequired: false,
    enabled: true,
    supportsStreaming: false,
  },
};
```

**Step 5: 移除不再需要的常量**

删除以下常量：
- `CODEX_ACP_BRIDGE_VERSION`
- `CODEX_ACP_NPX_PACKAGE`
- `POTENTIAL_ACP_CLIS` 相关代码（或简化为只检测 claude）

**Step 6: 运行类型检查**

Run: `bun run lint`
Expected: 可能有类型错误，后续任务修复

**Step 7: Commit**

```bash
git add src/types/acpTypes.ts
git commit -m "refactor(types): simplify ACP backend types to only support Claude"
```

---

### Task 1.2: 简化 TChatConversation 类型

**Files:**
- Modify: `src/common/storage.ts`

**Step 1: 简化 TChatConversation 联合类型**

将 `TChatConversation` 从 4 种类型简化为只保留 `acp`：
```typescript
export type TChatConversation = Omit<
  IChatConversation<
    'acp',
    {
      workspace?: string;
      backend: AcpBackend;
      cliPath?: string;
      customWorkspace?: boolean;
      agentName?: string;
      customAgentId?: string;
      presetContext?: string;
      enabledSkills?: string[];
      presetAssistantId?: string;
      pinned?: boolean;
      pinnedAt?: number;
      acpSessionId?: string;
      acpSessionUpdatedAt?: number;
      sessionMode?: string;
      currentModelId?: string;
      isHealthCheck?: boolean;
    }
  >,
  'model'
>;
```

**Step 2: 更新 IConfigStorageRefer**

移除 `codex.config` 相关配置（如果存在）。

**Step 3: 运行类型检查**

Run: `bun run lint`
Expected: 可能有类型错误，后续任务修复

**Step 4: Commit**

```bash
git add src/common/storage.ts
git commit -m "refactor(storage): simplify TChatConversation to only ACP type"
```

---

## Phase 2: 数据库迁移

### Task 2.1: 添加数据库迁移脚本

**Files:**
- Modify: `src/process/database/migrations.ts`
- Modify: `src/process/database/schema.ts`

**Step 1: 更新 schema 中的 type 约束**

在 `src/process/database/schema.ts` 中，将：
```sql
type TEXT NOT NULL check(type IN ('acp', 'codex', 'openclaw-gateway', 'nanobot'))
```

改为：
```sql
type TEXT NOT NULL check(type IN ('acp'))
```

**Step 2: 添加迁移脚本**

在 `migrations.ts` 中添加新迁移（版本 16）：
```typescript
const migration_v16: IMigration = {
  version: 16,
  name: 'Migrate non-ACP conversations to ACP type',
  up: (db) => {
    // 将 codex 类型转为 acp，backend 设为 codex
    db.exec(`
      UPDATE conversations
      SET type = 'acp',
          extra = json_set(extra, '$.backend', 'claude')
      WHERE type = 'codex';
    `);

    // 将 nanobot 类型转为 acp，backend 设为 claude
    db.exec(`
      UPDATE conversations
      SET type = 'acp',
          extra = json_set(extra, '$.backend', 'claude')
      WHERE type = 'nanobot';
    `);

    // 将 openclaw-gateway 类型转为 acp，backend 设为 claude
    db.exec(`
      UPDATE conversations
      SET type = 'acp',
          extra = json_set(extra, '$.backend', 'claude')
      WHERE type = 'openclaw-gateway';
    `);

    console.log('[Migration v16] Migrated non-ACP conversations to ACP type');
  },
  down: (db) => {
    // 无法完全恢复，因为原始类型信息已丢失
    console.log('[Migration v16] Rollback not supported - original types cannot be restored');
  },
};
```

**Step 3: 更新 CURRENT_DB_VERSION**

将 `CURRENT_DB_VERSION` 从 15 改为 16。

**Step 4: 注册迁移**

将 `migration_v16` 添加到 `migrations` 数组中。

**Step 5: Commit**

```bash
git add src/process/database/migrations.ts src/process/database/schema.ts
git commit -m "feat(db): add migration to convert non-ACP conversations to ACP type"
```

---

## Phase 3: 删除 Agent 实现

### Task 3.1: 删除 Codex Agent 目录

**Files:**
- Delete: `src/agent/codex/` 整个目录

**Step 1: 删除目录**

Run: `rm -rf src/agent/codex`

**Step 2: 检查依赖**

Run: `grep -r "from '@/agent/codex'" src/ || echo "No imports found"`

如果有导入，记录需要修改的文件。

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove Codex agent implementation"
```

---

### Task 3.2: 删除 Nanobot Agent 目录

**Files:**
- Delete: `src/agent/nanobot/` 整个目录

**Step 1: 删除目录**

Run: `rm -rf src/agent/nanobot`

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor: remove Nanobot agent implementation"
```

---

### Task 3.3: 删除 OpenClaw Agent 目录

**Files:**
- Delete: `src/agent/openclaw/` 整个目录

**Step 1: 删除目录**

Run: `rm -rf src/agent/openclaw`

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor: remove OpenClaw agent implementation"
```

---

## Phase 4: 删除 Worker 文件

### Task 4.1: 删除非 ACP Worker

**Files:**
- Delete: `src/worker/codex.ts`
- Delete: `src/worker/nanobot.ts`
- Delete: `src/worker/openclaw-gateway.ts`
- Modify: `electron.vite.config.ts`

**Step 1: 删除 Worker 文件**

Run: `rm src/worker/codex.ts src/worker/nanobot.ts src/worker/openclaw-gateway.ts`

**Step 2: 更新 electron.vite.config.ts**

在 `rollupOptions.input` 中移除已删除的 worker 入口：
```typescript
rollupOptions: {
  input: {
    index: resolve('src/index.ts'),
    acp: resolve('src/worker/acp.ts'),
    // 移除 codex, openclaw-gateway, nanobot
  },
  // ...
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove non-ACP worker files and config"
```

---

## Phase 5: 删除 Task Manager

### Task 5.1: 删除非 ACP Task Manager

**Files:**
- Delete: `src/process/task/CodexAgentManager.ts`
- Delete: `src/process/task/NanoBotAgentManager.ts`
- Delete: `src/process/task/OpenClawAgentManager.ts`
- Modify: `src/process/task/agentUtils.ts` (如有引用)

**Step 1: 删除文件**

Run: `rm src/process/task/CodexAgentManager.ts src/process/task/NanoBotAgentManager.ts src/process/task/OpenClawAgentManager.ts`

**Step 2: 更新引用文件**

检查并更新任何引用这些 manager 的文件。

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove non-ACP task managers"
```

---

## Phase 6: 删除 IPC Bridge

### Task 6.1: 移除 Codex Conversation Bridge

**Files:**
- Delete: `src/process/bridge/codexConversationBridge.ts`
- Modify: `src/process/bridge/index.ts`

**Step 1: 删除 Bridge 文件**

Run: `rm src/process/bridge/codexConversationBridge.ts`

**Step 2: 更新 bridge/index.ts**

移除 codexConversationBridge 的导入和初始化：
```typescript
// 移除这行
import { initCodexConversationBridge } from './codexConversationBridge';

// 在 initAllBridges 中移除
initCodexConversationBridge();

// 在导出中移除
export { ..., initCodexConversationBridge, ... };
```

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove Codex conversation bridge"
```

---

## Phase 7: 删除 UI 组件

### Task 7.1: 删除非 ACP 聊天组件

**Files:**
- Delete: `src/renderer/pages/conversation/codex/` 整个目录
- Delete: `src/renderer/pages/conversation/nanobot/` 整个目录
- Delete: `src/renderer/pages/conversation/openclaw/` 整个目录
- Delete: `src/renderer/messages/codex/` 整个目录

**Step 1: 删除目录**

Run:
```bash
rm -rf src/renderer/pages/conversation/codex
rm -rf src/renderer/pages/conversation/nanobot
rm -rf src/renderer/pages/conversation/openclaw
rm -rf src/renderer/messages/codex
```

**Step 2: 更新 ChatConversation.tsx**

检查并更新 `src/renderer/pages/conversation/ChatConversation.tsx`，移除对已删除组件的引用。

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(ui): remove non-ACP conversation components"
```

---

## Phase 8: 清理 initAgent

### Task 8.1: 移除非 ACP Agent 创建函数

**Files:**
- Modify: `src/process/initAgent.ts`

**Step 1: 删除废弃函数**

删除以下函数：
- `createCodexAgent`
- `createNanobotAgent`
- `createOpenClawAgent`

**Step 2: 移除无用导入**

移除 `computeOpenClawIdentityHash` 等不再需要的导入。

**Step 3: Commit**

```bash
git add src/process/initAgent.ts
git commit -m "refactor: remove non-ACP agent creation functions"
```

---

## Phase 9: 清理 i18n

### Task 9.1: 删除废弃的翻译文件

**Files:**
- Delete: `src/renderer/i18n/locales/*/codex.json`

**Step 1: 查找并删除**

Run:
```bash
find src/renderer/i18n/locales -name "codex.json" -delete
```

**Step 2: 更新 i18n 配置**

检查 `src/renderer/i18n/` 下的配置文件，移除对 codex 翻译的引用。

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(i18n): remove Codex translation files"
```

---

## Phase 10: 清理其他引用

### Task 10.1: 清理 MCP 服务中的 Agent 引用

**Files:**
- Check: `src/process/services/mcpServices/agents/`

**Step 1: 检查并清理**

Run: `grep -r "gemini\|qwen\|codex\|nanobot\|openclaw" src/process/services/`

根据结果清理相关引用。

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor: clean up agent references in MCP services"
```

---

### Task 10.2: 清理预设助手配置

**Files:**
- Check: `src/common/presets/assistantPresets.ts`
- Check: `src/renderer/constants/agentModes.ts`
- Check: `src/renderer/config/modelPlatforms.ts`

**Step 1: 检查预设配置**

确保所有预设助手的 `presetAgentType` 都是 `'claude'` 或已移除。

**Step 2: 更新 Agent Mode 配置**

移除非 Claude 的 agent mode 配置。

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: update preset assistant configurations"
```

---

### Task 10.3: 清理 openclawUtils

**Files:**
- Check: `src/process/utils/openclawUtils.ts`

**Step 1: 删除文件**

如果文件存在且不再需要：
Run: `rm src/process/utils/openclawUtils.ts`

**Step 2: 更新引用**

移除其他文件中对 openclawUtils 的引用。

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove openclaw utilities"
```

---

## Phase 11: 验证和测试

### Task 11.1: 运行完整测试

**Step 1: 运行 lint**

Run: `bun run lint`
Expected: 无错误

**Step 2: 运行测试**

Run: `bun run test`
Expected: 所有测试通过

**Step 3: 本地构建测试**

Run: `bun run package`
Expected: 构建成功

**Step 4: 手动测试**

- 启动应用：`bun run start`
- 创建新的 Claude Code 会话
- 验证现有会话（如果是升级）能正常显示

---

## Phase 12: 最终清理

### Task 12.1: 清理未使用的导入和变量

**Step 1: 运行 lint fix**

Run: `bun run lint:fix`

**Step 2: 手动检查剩余警告**

Run: `bun run lint 2>&1 | head -50`

**Step 3: 最终 commit**

```bash
git add -A
git commit -m "chore: cleanup unused imports and variables"
```

---

## 风险和注意事项

1. **数据迁移不可逆**：版本 16 的迁移将 codex/nanobot/openclaw 类型的对话转为 acp 类型，回滚时无法恢复原始类型。

2. **custom backend 保留**：保留 `custom` backend 以支持用户自定义 agent。

3. **API 兼容性**：如果有外部系统依赖这些 agent 类型，需要提前通知。

4. **测试覆盖**：删除代码前确保相关测试已更新或移除。

---

## 回滚计划

如果需要回滚：
1. 恢复 git 提交
2. 数据库需要手动处理（迁移不可逆）
3. 建议在删除前备份用户数据

---

## 文件变更摘要

### 删除的文件/目录
- `src/agent/codex/`
- `src/agent/nanobot/`
- `src/agent/openclaw/`
- `src/worker/codex.ts`
- `src/worker/nanobot.ts`
- `src/worker/openclaw-gateway.ts`
- `src/process/task/CodexAgentManager.ts`
- `src/process/task/NanoBotAgentManager.ts`
- `src/process/task/OpenClawAgentManager.ts`
- `src/process/bridge/codexConversationBridge.ts`
- `src/renderer/pages/conversation/codex/`
- `src/renderer/pages/conversation/nanobot/`
- `src/renderer/pages/conversation/openclaw/`
- `src/renderer/messages/codex/`
- `src/renderer/i18n/locales/*/codex.json`
- `src/process/utils/openclawUtils.ts` (可能)

### 修改的文件
- `src/types/acpTypes.ts`
- `src/common/storage.ts`
- `src/process/database/schema.ts`
- `src/process/database/migrations.ts`
- `src/process/bridge/index.ts`
- `src/process/initAgent.ts`
- `electron.vite.config.ts`
- `src/common/presets/assistantPresets.ts` (可能)
- `src/renderer/constants/agentModes.ts` (可能)
