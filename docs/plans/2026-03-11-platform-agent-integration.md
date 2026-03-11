# Platform Agent Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use summ:executing-plans to implement this plan task-by-task.

**Goal:** 统一助手体系，所有助手从平台下载，移除内置/自定义助手概念。

**Architecture:** 平台 API 直接返回 `AcpBackendConfig` 格式，客户端下载后存入 `acp.customAgents`，规则文件存入 `assistants/` 目录，复用现有提示词注入逻辑。

**Tech Stack:** TypeScript, Electron IPC, better-sqlite3, React

---

## Task 1: 扩展 AcpBackendConfig 类型

**Files:**
- Modify: `src/types/acpTypes.ts`

**Step 1: 添加平台相关字段**

在 `AcpBackendConfig` 接口中添加：

```typescript
export interface AcpBackendConfig {
  // ... 现有字段 ...

  /** 平台版本号 / Platform version */
  platformVersion?: string;

  /** 安装时间 / Installation timestamp */
  installedAt?: string;
}
```

**Step 2: 移除不再需要的字段（标记为可选）**

确保以下字段存在但可选（已有）：
- `isBuiltin` - 将被废弃
- `isPreset` - 保留，用于区分是否为预设助手
- `isPlatform` - 不再需要（全是平台助手）

**Step 3: 提交**

```bash
git add src/types/acpTypes.ts
git commit -m "types(acp): add platformVersion and installedAt fields"
```

---

## Task 2: 更新 platformTypes 类型定义

**Files:**
- Modify: `src/common/types/platformTypes.ts`

**Step 1: 简化 PlatformAgent 类型**

将 `PlatformAgent` 改为直接复用 `AcpBackendConfig`：

```typescript
import type { AcpBackendConfig } from '@/types/acpTypes';

/** 平台助手配置（直接复用 AcpBackendConfig）*/
export type PlatformAgentConfig = AcpBackendConfig & {
  /** 安装状态 */
  status: 'installed' | 'update_available' | 'not_installed';

  /** 下载地址 */
  downloadUrl: string;
};

/** 平台助手列表响应 */
export type PlatformAgentListResponse = PlatformAgentConfig[];
```

**Step 2: 移除旧的 PlatformAgent 接口**

删除原有的 `PlatformAgent` 接口定义。

**Step 3: 提交**

```bash
git add src/common/types/platformTypes.ts
git commit -m "types(platform): simplify PlatformAgent to reuse AcpBackendConfig"
```

---

## Task 3: 重写 platformBridge 下载逻辑

**Files:**
- Modify: `src/process/bridge/platformBridge.ts`

**Step 1: 添加解压和文件处理逻辑**

在文件顶部添加：

```typescript
import { unzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import type { PlatformAgentConfig } from '@/common/types/platformTypes';
import type { AcpBackendConfig } from '@/types/acpTypes';
```

**Step 2: 实现助手安装函数**

```typescript
async function installAgentPackage(
  agentId: string,
  zipBuffer: Buffer,
  assistantsDir: string
): Promise<{ rulesFiles: string[]; skillsFiles: string[] }> {
  const rulesFiles: string[] = [];
  const skillsFiles: string[] = [];

  // 解压 zip 并写入文件
  const { dirname, join } = path;
  const tempDir = join(assistantsDir, `.tmp-${agentId}-${Date.now()}`);

  // 使用 adm-zip 或类似库解压
  // 遍历解压后的文件，识别规则文件和技能文件
  // 写入到 assistants/{agentId}.{locale}.md
  // 写入到 assistants/{agentId}-skills.{locale}.md

  return { rulesFiles, skillsFiles };
}
```

**Step 3: 重写 downloadAgent handler**

```typescript
ipcBridge.platform.downloadAgent.provider(async ({ agentId }) => {
  try {
    // 1. 获取助手配置
    const agentsResult = await fetchApi<PlatformAgentConfig[]>('/api/agents');
    if (!agentsResult.success || !agentsResult.data) {
      return { success: false, msg: 'Failed to fetch agent config' };
    }

    const agentConfig = agentsResult.data.find(a => a.id === agentId);
    if (!agentConfig) {
      return { success: false, msg: 'Agent not found' };
    }

    // 2. 下载 zip 包
    const response = await fetch(agentConfig.downloadUrl, {
      headers: buildAuthHeaders(),
    });
    if (!response.ok) {
      return { success: false, msg: 'Download failed' };
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer());

    // 3. 解压并写入规则文件
    const assistantsDir = getAssistantsDir();
    await installAgentPackage(agentId, zipBuffer, assistantsDir);

    // 4. 保存配置到 acp.customAgents
    const existingAgents = await ConfigStorage.get('acp.customAgents') || [];
    const agentToSave: AcpBackendConfig = {
      ...agentConfig,
      isPreset: true,
      installedAt: new Date().toISOString(),
    };
    delete (agentToSave as any).status;
    delete (agentToSave as any).downloadUrl;

    const existingIndex = existingAgents.findIndex((a: any) => a.id === agentId);
    if (existingIndex >= 0) {
      existingAgents[existingIndex] = { ...existingAgents[existingIndex], ...agentToSave };
    } else {
      existingAgents.push(agentToSave);
    }

    await ConfigStorage.set('acp.customAgents', existingAgents);

    return { success: true };
  } catch (error) {
    console.error('[Platform] Download agent error:', error);
    return { success: false, msg: error instanceof Error ? error.message : 'Download failed' };
  }
});
```

**Step 4: 添加依赖（如需要）**

如果需要解压 zip，安装 adm-zip：
```bash
bun add adm-zip
bun add -d @types/adm-zip
```

**Step 5: 提交**

```bash
git add src/process/bridge/platformBridge.ts
git commit -m "feat(platform): rewrite download logic to save to acp.customAgents"
```

---

## Task 4: 更新 getAgentList handler

**Files:**
- Modify: `src/process/bridge/platformBridge.ts`

**Step 1: 合并平台数据和本地安装状态**

```typescript
ipcBridge.platform.getAgentList.provider(async () => {
  if (IS_DEV) {
    // 开发模式：返回 mock 数据，但需要包含本地安装状态
    const localAgents = await ConfigStorage.get('acp.customAgents') || [];
    const mockData = getMockPlatformAgents();

    const merged = mockData.map(agent => {
      const local = localAgents.find((a: any) => a.id === agent.id);
      return {
        ...agent,
        status: local ? 'installed' : agent.status,
        platformVersion: agent.platformVersion,
      };
    });

    return { success: true, data: merged };
  }

  // 生产模式：从 API 获取
  const result = await fetchApi<PlatformAgentConfig[]>('/api/agents');
  if (result.success && result.data) {
    const localAgents = await ConfigStorage.get('acp.customAgents') || [];

    // 合并本地安装状态
    result.data = result.data.map(agent => {
      const local = localAgents.find((a: any) => a.id === agent.id);
      if (local) {
        const localVersion = local.platformVersion;
        const remoteVersion = agent.platformVersion;
        const needsUpdate = localVersion && remoteVersion && localVersion !== remoteVersion;
        return {
          ...agent,
          status: needsUpdate ? 'update_available' : 'installed',
        };
      }
      return { ...agent, status: 'not_installed' };
    });
  }

  return result;
});
```

**Step 2: 更新 mock 数据格式**

```typescript
const getMockPlatformAgents = (): PlatformAgentConfig[] => [
  {
    id: 'cowork',
    name: 'Cowork',
    nameI18n: { 'zh-CN': 'Cowork', 'en-US': 'Cowork' },
    description: 'Autonomous task execution assistant',
    descriptionI18n: {
      'zh-CN': '具有文件操作、文档处理和多步骤工作流规划的自主任务执行助手。',
      'en-US': 'Autonomous task execution with file operations, document processing, and multi-step workflow planning.',
    },
    avatar: 'cowork',
    isPreset: true,
    platformVersion: '1.0.0',
    presetAgentType: 'claude',
    promptsI18n: {
      'zh-CN': ['分析当前项目结构并建议改进方案', '自动化构建和部署流程'],
      'en-US': ['Analyze the current project structure', 'Automate the build and deployment process'],
    },
    status: 'not_installed',
    downloadUrl: 'https://example.com/agents/cowork-1.0.0.zip',
  },
  // ... 其他 mock 助手
];
```

**Step 3: 提交**

```bash
git add src/process/bridge/platformBridge.ts
git commit -m "feat(platform): merge platform agents with local install status"
```

---

## Task 5: 添加助手卸载功能

**Files:**
- Modify: `src/process/bridge/platformBridge.ts`
- Modify: `src/common/ipcBridge.ts`

**Step 1: 添加 uninstallAgent IPC 定义**

在 `src/common/ipcBridge.ts` 中添加：

```typescript
// 在 platform 命名空间中添加
uninstallAgent: createIpcDefinition<{
  agentId: string;
}, void>('platform:uninstallAgent');
```

**Step 2: 实现 uninstallAgent handler**

```typescript
ipcBridge.platform.uninstallAgent.provider(async ({ agentId }) => {
  try {
    // 1. 从 acp.customAgents 中移除
    const existingAgents = await ConfigStorage.get('acp.customAgents') || [];
    const filteredAgents = existingAgents.filter((a: any) => a.id !== agentId);
    await ConfigStorage.set('acp.customAgents', filteredAgents);

    // 2. 删除规则文件
    const assistantsDir = getAssistantsDir();
    const files = fs.readdirSync(assistantsDir);
    for (const file of files) {
      if (file.startsWith(`${agentId}.`) || file.startsWith(`${agentId}-skills.`)) {
        fs.unlinkSync(path.join(assistantsDir, file));
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[Platform] Uninstall agent error:', error);
    return { success: false, msg: error instanceof Error ? error.message : 'Uninstall failed' };
  }
});
```

**Step 3: 提交**

```bash
git add src/common/ipcBridge.ts src/process/bridge/platformBridge.ts
git commit -m "feat(platform): add uninstallAgent IPC handler"
```

---

## Task 6: 更新 initStorage 移除内置助手逻辑

**Files:**
- Modify: `src/process/initStorage.ts`

**Step 1: 移除 ASSISTANT_PRESETS 导入和相关逻辑**

删除：
```typescript
import { ASSISTANT_PRESETS } from '@/common/presets/assistantPresets';
```

删除 `initBuiltinAssistantRules` 函数。

删除 `getBuiltinAssistants` 函数。

**Step 2: 添加首次启动下载默认助手逻辑**

```typescript
const initDefaultAgents = async (): Promise<void> => {
  const existingAgents = await ConfigStorage.get('acp.customAgents');

  // 如果已有助手，跳过
  if (existingAgents && existingAgents.length > 0) {
    return;
  }

  // 首次启动，自动下载默认助手（cowork）
  try {
    const result = await fetchApi<PlatformAgentConfig[]>('/api/agents');
    if (result.success && result.data) {
      const cowork = result.data.find(a => a.id === 'cowork');
      if (cowork) {
        // 下载并安装 cowork
        await ConfigStorage.set('acp.customAgents', [{
          ...cowork,
          isPreset: true,
          enabled: true,
          installedAt: new Date().toISOString(),
        }]);
        console.log('[AionUi] Default agent (cowork) initialized');
      }
    }
  } catch (error) {
    console.warn('[AionUi] Failed to initialize default agent:', error);
  }
};
```

**Step 3: 在 initStorage 中调用**

```typescript
const initStorage = async () => {
  // ... 现有初始化逻辑 ...

  // 替换原来的内置助手初始化
  await initDefaultAgents();

  // ... 其余逻辑 ...
};
```

**Step 4: 提交**

```bash
git add src/process/initStorage.ts
git commit -m "refactor(storage): remove builtin assistants, use platform agents"
```

---

## Task 7: 删除 assistantPresets.ts

**Files:**
- Delete: `src/common/presets/assistantPresets.ts`

**Step 1: 删除文件**

```bash
rm src/common/presets/assistantPresets.ts
```

**Step 2: 检查并清理所有引用**

搜索所有导入 `ASSISTANT_PRESETS` 的文件并移除引用。

**Step 3: 提交**

```bash
git add -A
git commit -m "refactor: remove ASSISTANT_PRESETS, all agents from platform now"
```

---

## Task 8: 更新 AssistantManagement 设置页

**Files:**
- Modify: `src/renderer/pages/settings/AssistantManagement.tsx`

**Step 1: 移除自定义助手创建/编辑相关代码**

删除：
- 自定义助手创建按钮
- 自定义助手编辑表单
- EmojiPicker 相关导入和逻辑
- 所有 `isBuiltin` 相关的判断逻辑

**Step 2: 添加平台助手列表展示**

```tsx
// 已安装助手（来自 acp.customAgents）
const installedAgents = customAgents.filter(a => a.enabled !== false);

// 可安装助手（从平台获取，未在本地）
const { data: platformAgents } = useSWR('platform.agents', async () => {
  const result = await ipcBridge.platform.getAgentList.invoke();
  return result.success ? result.data : [];
});

const availableAgents = platformAgents?.filter(
  platformAgent => !customAgents.some(local => local.id === platformAgent.id)
) || [];
```

**Step 3: 更新 UI 结构**

```tsx
return (
  <div className="assistant-management">
    {/* 已安装 */}
    <section>
      <h3>{t('settings.installedAgents')}</h3>
      {installedAgents.map(agent => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onEnterConversation={() => navigate('/guid', { state: { agentId: agent.id } })}
          onUninstall={() => handleUninstall(agent.id)}
        />
      ))}
    </section>

    {/* 可安装 */}
    <section>
      <h3>{t('settings.availableAgents')}</h3>
      {availableAgents.map(agent => (
        <AgentCard
          key={agent.id}
          agent={agent}
          status={agent.status}
          onInstall={() => handleInstall(agent.id)}
        />
      ))}
    </section>
  </div>
);
```

**Step 4: 提交**

```bash
git add src/renderer/pages/settings/AssistantManagement.tsx
git commit -m "refactor(settings): simplify assistant management for platform agents only"
```

---

## Task 9: 删除 PlatformAgentList 页面

**Files:**
- Delete: `src/renderer/pages/settings/PlatformAgentList.tsx`
- Modify: `src/renderer/pages/settings/index.tsx` (移除路由)

**Step 1: 删除文件**

```bash
rm src/renderer/pages/settings/PlatformAgentList.tsx
rm -rf src/renderer/components/PlatformAgentCard
```

**Step 2: 移除路由引用**

检查并移除相关路由配置。

**Step 3: 提交**

```bash
git add -A
git commit -m "refactor: remove PlatformAgentList, merged into AssistantManagement"
```

---

## Task 10: 清理无用字段和代码

**Files:**
- Multiple files (搜索清理)

**Step 1: 搜索并移除 isBuiltin 相关代码**

```bash
grep -r "isBuiltin" src/
```

逐个文件清理，确保：
- 移除所有 `isBuiltin` 相关的判断逻辑
- 移除所有 `builtin-` 前缀的处理逻辑

**Step 2: 搜索并移除 isPlatform 相关代码**

如果不再需要区分，移除 `isPlatform` 字段。

**Step 3: 清理旧文件**

```bash
# 移除 builtin 相关的规则文件模板
rm -rf rules/
rm -rf assistant/
```

**Step 4: 提交**

```bash
git add -A
git commit -m "refactor: cleanup builtin/platform related code"
```

---

## Task 11: 更新 Guid 页面助手选择逻辑

**Files:**
- Modify: `src/renderer/pages/guid/GuidPage.tsx`

**Step 1: 验证 agentId 来自 location.state 的处理**

确保从平台助手列表点击"进入对话"后能正确选中助手：

```tsx
useEffect(() => {
  const state = location.state as { agentId?: string } | null;
  if (state?.agentId) {
    // agentId 现在直接是 "cowork" 或 "platform-docking" 等
    const agentExists = agentSelection.availableAgents?.some(
      (a) => agentSelection.getAgentKey(a) === state.agentId
    );
    if (agentExists) {
      agentSelection.setSelectedAgentKey(state.agentId);
    }
    window.history.replaceState({}, '');
  }
}, [location.state, agentSelection]);
```

**Step 2: 更新 getAgentKey 逻辑（如需要）**

确认 `getAgentKey` 函数能正确处理平台助手 ID：

```typescript
const getAgentKey = (agent: { backend: AcpBackend; customAgentId?: string }) => {
  // 平台助手的 backend 是 'custom'，customAgentId 是助手 ID
  return agent.backend === 'custom' && agent.customAgentId
    ? `custom:${agent.customAgentId}`
    : agent.backend;
};
```

**Step 3: 提交**

```bash
git add src/renderer/pages/guid/GuidPage.tsx
git commit -m "fix(guid): ensure platform agent selection works from location state"
```

---

## Task 12: 验证和测试

**Step 1: 手动测试流程**

1. 启动应用
2. 验证首次启动自动下载 cowork
3. 进入设置页，查看助手列表
4. 安装一个新助手
5. 卸载一个助手
6. 进入 Guid 页面，验证助手选择
7. 创建对话，验证提示词注入

**Step 2: 运行现有测试**

```bash
bun run test
```

**Step 3: 修复失败的测试**

根据测试结果修复相关代码。

**Step 4: 最终提交**

```bash
git add -A
git commit -m "test: fix tests after platform agent integration"
```

---

## 执行顺序

1. Task 1-2: 类型定义（可并行）
2. Task 3-5: platformBridge 改造（顺序执行）
3. Task 6-7: 存储层改造（顺序执行）
4. Task 8-9: UI 改造（可并行）
5. Task 10: 清理代码
6. Task 11: Guid 页面验证
7. Task 12: 测试验证

---

## 风险点

1. **数据迁移** - 老用户升级后可能丢失内置助手配置
   - 缓解：在 initStorage 中检测并迁移

2. **平台 API 不可用** - 网络问题导致无法获取助手列表
   - 缓解：使用本地缓存，显示离线提示

3. **规则文件格式变化** - 平台下发的文件格式与现有不一致
   - 缓解：定义清晰的文件命名规范
