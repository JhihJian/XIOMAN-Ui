# Assistant 配置与 Claude Code 集成机制

本文档说明 AionUi 中智能助手（Assistant）配置如何与 Claude Code、Codex、Gemini 等 AI 后端结合使用。

## 概述

AionUi 使用 TypeScript 定义助手预设配置，通过文件系统将规则和技能文件复制到用户目录，然后在创建会话时将这些配置注入到首条消息中，使 AI 能够遵循特定的行为规则并使用相关技能。

## 配置文件格式

### TypeScript 类型定义

助手配置定义在 `src/common/presets/assistantPresets.ts`：

```typescript
type AssistantPreset = {
  id: string;                    // 唯一标识符
  avatar: string;                // 头像 (emoji 或图片路径)
  presetAgentType?: PresetAgentType; // 代理类型 (如 'gemini', 'claude', 'codex')
  resourceDir?: string;          // 资源目录 (相对于项目根目录)
  ruleFiles: Record<string, string>;      // 规则文件 (按语言)
  skillFiles?: Record<string, string>;    // 技能文件 (按语言，可选)
  defaultEnabledSkills?: string[];         // 默认启用的技能列表
  nameI18n: Record<string, string>;        // 多语言名称
  descriptionI18n: Record<string, string>; // 多语言描述
  promptsI18n?: Record<string, string[]>;  // 示例提示词
};
```

### 配置示例

```typescript
{
  id: 'cowork',
  avatar: 'cowork.svg',
  presetAgentType: 'gemini',
  resourceDir: 'assistant/cowork',
  ruleFiles: {
    'en-US': 'cowork.md',
    'zh-CN': 'cowork.md',
  },
  skillFiles: {
    'en-US': 'cowork-skills.md',
    'zh-CN': 'cowork-skills.zh-CN.md',
  },
  defaultEnabledSkills: ['skill-creator', 'pptx', 'docx', 'pdf', 'xlsx'],
  nameI18n: {
    'en-US': 'Cowork',
    'zh-CN': 'Cowork',
  },
  descriptionI18n: {
    'en-US': 'Autonomous task execution...',
    'zh-CN': '自主任务执行助手...',
  },
}
```

### 文件结构

```
project-root/
├── assistant/                    # 助手资源目录
│   ├── cowork/
│   │   ├── cowork.md             # 规则文件 (英文)
│   │   ├── cowork.zh-CN.md       # 规则文件 (中文)
│   │   ├── cowork-skills.md      # 技能文件 (英文)
│   │   └── cowork-skills.zh-CN.md # 技能文件 (中文)
│   └── pptx-generator/
│       ├── pptx-generator.md
│       └── pptx-generator.zh-CN.md
├── skills/                       # 技能脚本目录
│   ├── _builtin/                 # 内置技能 (自动启用)
│   │   ├── cron/
│   │   │   └── SKILL.md
│   │   └── ...
│   ├── pptx/
│   │   └── SKILL.md
│   └── ...
└── src/common/presets/
    └── assistantPresets.ts       # 助手预设定义
```

## 集成流程

### 架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                    assistantPresets.ts (TypeScript 定义)              │
│  - 定义助手元数据 (id, nameI18n, avatar, ruleFiles, skillFiles)       │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    initStorage.ts (初始化)                            │
│  1. 将 ruleFiles/*.md 复制到用户目录                                   │
│     → ~/.aionui/assistants/builtin-{id}.{locale}.md                   │
│  2. 将 skillFiles/*.md 复制到用户目录                                  │
│     → ~/.aionui/assistants/builtin-{id}-skills.{locale}.md            │
│  3. 将 skills/ 目录复制到用户目录                                       │
│     → ~/.aionui/skills/                                              │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│              useGuidAgentSelection.ts (前端选择助手)                   │
│  - resolvePresetContext(): 读取规则文件                                │
│  - resolveEnabledSkills(): 获取启用的技能列表                           │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    agentUtils.ts (构建系统指令)                        │
│                                                                       │
│  方式1: prepareFirstMessage (Gemini - 完整内容注入)                    │
│    → 将 rules + skills 全文直接注入首条消息                            │
│                                                                       │
│  方式2: prepareFirstMessageWithSkillsIndex (Claude/Codex - 索引注入)   │
│    → 注入 rules + skills 索引                                         │
│    → Agent 通过 Read 工具按需读取 SKILL.md 文件                        │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    首条消息格式                                        │
│                                                                       │
│  [Assistant Rules - You MUST follow these instructions]               │
│  {规则文件内容 (cowork.md)}                                            │
│                                                                       │
│  [Skills Location]                                                    │
│  Skills are stored in:                                                │
│  - Builtin skills: ~/.aionui/skills/_builtin/{skill}/SKILL.md        │
│  - Optional skills: ~/.aionui/skills/{skill}/SKILL.md                │
│                                                                       │
│  [User Request]                                                       │
│  {用户输入}                                                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 关键代码路径

#### 1. 初始化 - 复制文件到用户目录 (`initStorage.ts`)

```typescript
// 初始化内置助手的规则和技能文件到用户目录
const initBuiltinAssistantRules = async () => {
  const assistantsDir = getAssistantsDir(); // ~/.aionui/assistants/

  for (const preset of ASSISTANT_PRESETS) {
    const assistantId = `builtin-${preset.id}`;

    // 复制规则文件
    for (const [locale, ruleFile] of Object.entries(preset.ruleFiles)) {
      const sourcePath = path.join(presetRulesDir, ruleFile);
      const targetPath = path.join(assistantsDir, `${assistantId}.${locale}.md`);

      // 替换相对路径为绝对路径
      let content = await fs.readFile(sourcePath, 'utf-8');
      content = content.replace(/skills\//g, userSkillsDir + '/');
      await fs.writeFile(targetPath, content);
    }

    // 复制技能文件 (如果存在)
    if (preset.skillFiles) {
      // ... 类似处理
    }
  }
};
```

#### 2. 前端加载 - 读取规则和技能 (`useGuidAgentSelection.ts`)

```typescript
const resolvePresetRulesAndSkills = async (agentInfo) => {
  // 1. 尝试从用户目录读取规则文件
  rules = await ipcBridge.fs.readAssistantRule.invoke({
    assistantId: customAgentId,  // e.g., "builtin-cowork"
    locale: localeKey,           // e.g., "zh-CN"
  });

  // 2. 尝试从用户目录读取技能文件
  skills = await ipcBridge.fs.readAssistantSkill.invoke({
    assistantId: customAgentId,
    locale: localeKey,
  });

  // 3. 如果是内置助手，回退到项目内置文件
  if (customAgentId.startsWith('builtin-')) {
    const preset = ASSISTANT_PRESETS.find(p => p.id === presetId);
    rules = await ipcBridge.fs.readBuiltinRule.invoke({ fileName: ruleFile });
  }

  return { rules, skills };
};
```

#### 3. 消息注入 - 构建首条消息 (`agentUtils.ts`)

```typescript
// Claude Code / Codex 使用索引模式
export async function prepareFirstMessageWithSkillsIndex(content, config) {
  const instructions: string[] = [];

  // 1. 添加规则内容
  if (config.presetContext) {
    instructions.push(config.presetContext);  // cowork.md 内容
  }

  // 2. 加载 skills 索引（不注入全文）
  const skillManager = AcpSkillManager.getInstance(config.enabledSkills);
  await skillManager.discoverSkills(config.enabledSkills);

  // 3. 告诉 Agent skills 文件位置，按需读取
  if (skillManager.hasAnySkills()) {
    const skillsInstruction = `
[Skills Location]
Skills are stored in two locations:
- Builtin skills (auto-enabled): ${builtinSkillsDir}/{skill-name}/SKILL.md
- Optional skills: ${skillsDir}/{skill-name}/SKILL.md

Each skill has a SKILL.md file containing detailed instructions.
To use a skill, read its SKILL.md file when needed.

For example:
- Builtin "cron" skill: ${builtinSkillsDir}/cron/SKILL.md
- Optional "pptx" skill: ${skillsDir}/pptx/SKILL.md`;
    instructions.push(skillsInstruction);
  }

  // 4. 组装最终消息
  const systemInstructions = instructions.join('\n\n');
  return `[Assistant Rules - You MUST follow these instructions]\n${systemInstructions}\n\n[User Request]\n${content}`;
}
```

## 后端差异

### Claude Code / Codex vs Gemini

| 特性 | Claude Code / Codex | Gemini |
|------|---------------------|--------|
| **注入方式** | 索引模式 | 完整内容 |
| **Skills 加载** | 注入索引，按需读取 SKILL.md | 直接注入完整内容 |
| **文件读取** | Agent 有 Read 工具，可自行读取 | 无文件读取能力 |
| **上下文效率** | 高（按需加载） | 低（全量注入） |
| **动态加载** | 支持（通过 `[LOAD_SKILL: name]`） | 不支持 |

### Gemini 特殊处理

Gemini 没有文件读取能力，因此需要直接注入完整内容：

```typescript
// Gemini 使用完整内容注入
export async function prepareFirstMessage(content, config) {
  const systemInstructions = await buildSystemInstructions(config);
  // config.presetContext + loadSkillsContent(config.enabledSkills) 全文

  return `[Assistant Rules - You MUST follow these instructions]\n${systemInstructions}\n\n[User Request]\n${content}`;
}
```

## 实际示例

### Cowork 助手完整流程

当用户选择 "Cowork" 助手并发送消息时：

1. **读取规则**: `~/.aionui/assistants/builtin-cowork.zh-CN.md`
2. **读取技能索引**: 扫描 `~/.aionui/skills/_builtin/` 和 `~/.aionui/skills/`
3. **启用的技能**: `['skill-creator', 'pptx', 'docx', 'pdf', 'xlsx']`
4. **注入首条消息**:

```
[Assistant Rules - You MUST follow these instructions]
# Cowork Assistant

You are a Cowork assistant for autonomous task execution with file system access and document processing capabilities.

## File Path Rules
**CRITICAL**: When users mention a file (e.g., "read this PDF", "analyze the document"):
1. **Default to workspace**: Files are assumed to be in the current workspace...
...

[Available Skills]
## Skill: pptx
name: PowerPoint Presentation Generator
triggers: PowerPoint, presentation, .pptx, slides...

## Skill: docx
name: Word Document Handler
triggers: Word, document, .docx, report...

[Skills Location]
Skills are stored in two locations:
- Builtin skills (auto-enabled): /Users/xxx/.aionui/skills/_builtin/{skill-name}/SKILL.md
- Optional skills: /Users/xxx/.aionui/skills/{skill-name}/SKILL.md

Each skill has a SKILL.md file containing detailed instructions.
To use a skill, read its SKILL.md file when needed.

[User Request]
帮我创建一个关于 AI 趋势的演示文稿
```

## 相关文件

| 文件路径 | 作用 |
|----------|------|
| `src/common/presets/assistantPresets.ts` | 助手预设配置定义 |
| `src/process/initStorage.ts` | 初始化、文件复制、skills 加载 |
| `src/renderer/pages/guid/hooks/useGuidAgentSelection.ts` | 前端助手选择、规则/技能读取 |
| `src/process/task/agentUtils.ts` | 构建系统指令、首条消息注入 |
| `src/process/task/AcpSkillManager.ts` | Skills 管理、索引构建 |
| `src/common/ipcBridge.ts` | IPC 通信 (readAssistantRule 等) |
| `src/process/bridge/fsBridge.ts` | 文件系统操作 |

## 扩展指南

### 添加新助手

1. 在 `assistant/` 目录下创建新的助手文件夹
2. 添加规则文件 `{name}.md` 和可选的技能文件 `{name}-skills.md`
3. 在 `assistantPresets.ts` 中添加配置
4. 如需新的技能，在 `skills/` 目录下创建

### 添加新技能

1. 在 `skills/` 目录下创建 `{skill-name}/SKILL.md`
2. 如果是内置技能（自动启用），放在 `skills/_builtin/` 下
3. 在助手的 `defaultEnabledSkills` 中引用

## 注意事项

1. **路径替换**: 初始化时会将规则文件中的 `skills/` 相对路径替换为用户目录的绝对路径
2. **缓存**: skills 内容会被缓存，更新后需调用 `clearSkillsCache()`
3. **多语言**: 规则和技能文件支持多语言，按 `{name}.{locale}.md` 命名
4. **内置 vs 自定义**: 内置助手 ID 以 `builtin-` 前缀标识，始终强制更新以保持最新版本
