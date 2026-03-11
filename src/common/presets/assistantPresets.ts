import type { PresetAgentType } from '@/types/acpTypes';

export type AssistantPreset = {
  id: string;
  avatar: string;
  presetAgentType?: PresetAgentType;
  /**
   * Directory containing all resources for this preset (relative to project root).
   * If set, both ruleFiles and skillFiles will be resolved from this directory.
   * Default: rules/ for rules, skills/ for skills
   */
  resourceDir?: string;
  ruleFiles: Record<string, string>;
  skillFiles?: Record<string, string>;
  /**
   * Default enabled skills for this assistant (skill names from skills/ directory).
   * 此助手默认启用的技能列表（来自 skills/ 目录的技能名称）
   */
  defaultEnabledSkills?: string[];
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  promptsI18n?: Record<string, string[]>;
};

export const ASSISTANT_PRESETS: AssistantPreset[] = [
  {
    id: 'cowork',
    avatar: 'cowork.svg',
    presetAgentType: 'acp',
    resourceDir: 'assistant/cowork',
    ruleFiles: {
      'en-US': 'cowork.md',
      'zh-CN': 'cowork.md', // 使用同一个文件，内容已精简 / Use same file, content is simplified
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
      'en-US': 'Autonomous task execution with file operations, document processing, and multi-step workflow planning.',
      'zh-CN': '具有文件操作、文档处理和多步骤工作流规划的自主任务执行助手。',
    },
    promptsI18n: {
      'en-US': ['Analyze the current project structure and suggest improvements', 'Automate the build and deployment process', 'Extract and summarize key information from all PDF files'],
      'zh-CN': ['分析当前项目结构并建议改进方案', '自动化构建和部署流程', '提取并总结所有 PDF 文件的关键信息'],
    },
  },
];
