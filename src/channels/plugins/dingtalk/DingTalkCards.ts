/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelAgentType } from '../../types';

/**
 * DingTalk Message Cards for Personal Assistant
 *
 * DingTalk uses interactive message cards (ActionCard).
 * Cards support markdown content, buttons, and action callbacks.
 *
 * Card Structure:
 * - title: Card title
 * - text: Markdown content
 * - btnOrientation: Button layout ('0' vertical, '1' horizontal)
 * - btns: Array of buttons with title and actionURL
 *
 * For AI Card streaming, a different API flow is used (create -> stream -> finish).
 * These cards are used for static interactive messages.
 */

// ==================== Types ====================

/**
 * DingTalk card button
 */
export interface DingTalkButton {
  title: string;
  actionURL: string;
}

/**
 * DingTalk ActionCard structure
 */
export interface DingTalkCard {
  title: string;
  text: string;
  btnOrientation?: string;
  btns?: DingTalkButton[];
  singleTitle?: string;
  singleURL?: string;
}

/**
 * Agent info for card display
 */
export interface AgentDisplayInfo {
  type: ChannelAgentType;
  emoji: string;
  name: string;
}

// ==================== Helpers ====================

/**
 * Build a callback action URL for DingTalk card buttons
 * Uses a custom protocol that the plugin will intercept
 */
function actionUrl(action: string, params?: Record<string, string>): string {
  const allParams = { action, ...params };
  return `dtmd://dingtalkclient/sendMessage?content=${encodeURIComponent(JSON.stringify(allParams))}`;
}

/**
 * Build button from action info
 */
function btn(label: string, action: string, params?: Record<string, string>): DingTalkButton {
  return {
    title: label,
    actionURL: actionUrl(action, params),
  };
}

// ==================== Card Builders ====================

/**
 * Create main menu card
 */
export function createMainMenuCard(): DingTalkCard {
  return {
    title: '全国一体化智能终端助手',
    text: '### 全国一体化智能终端助手\n\n欢迎！请选择操作：',
    btnOrientation: '1',
    btns: [btn('New Chat', 'session.new'), btn('Agent', 'agent.show'), btn('Status', 'session.status'), btn('Help', 'help.show')],
  };
}

/**
 * Create pairing card
 */
export function createPairingCard(pairingCode: string): DingTalkCard {
  return {
    title: '需要配对',
    text: ['### 需要配对', '', '请将您的账号与 全国一体化智能终端 配对：', '', `**配对码：** \`${pairingCode}\``, '', '1. 打开 全国一体化智能终端 设置', '2. 进入 渠道 > 钉钉', '3. 输入此配对码', '', '代码有效期 10 分钟。'].join('\n'),
    btnOrientation: '1',
    btns: [btn('Refresh Code', 'pairing.refresh'), btn('Help', 'pairing.help')],
  };
}

/**
 * Create pairing status card
 */
export function createPairingStatusCard(pairingCode: string): DingTalkCard {
  return {
    title: '等待批准',
    text: ['### 等待批准', '', '您的配对请求待批准。', '', `**配对码：** \`${pairingCode}\``, '', '请在 全国一体化智能终端 设置中批准：', '1. 打开 全国一体化智能终端 App', '2. 进入 WebUI > 渠道', '3. 点击此代码的"批准"按钮'].join('\n'),
    btnOrientation: '1',
    btns: [btn('Check Status', 'pairing.check'), btn('New Code', 'pairing.refresh')],
  };
}

/**
 * Create pairing help card
 */
export function createPairingHelpCard(): DingTalkCard {
  return {
    title: '配对帮助',
    text: ['### 配对帮助', '', '**什么是配对？**', '配对将您的钉钉账号与本地 全国一体化智能终端 应用程序关联。', '使用 AI 助手前需要先配对。', '', '**如何配对：**', '1. 向此机器人发送任意消息', '2. 您将收到一个配对码', '3. 打开 全国一体化智能终端 桌面 App', '4. 进入 WebUI > 渠道 > 钉钉', '5. 点击您的代码的"批准"按钮', '', '**常见问题：**', '- 配对码有效期 10 分钟', '- 全国一体化智能终端 App 必须处于运行状态', '- 一个账号只能配对一次'].join('\n'),
    btns: [btn('Get Pairing Code', 'pairing.show')],
  };
}

/**
 * Create agent selection card
 */
export function createAgentSelectionCard(availableAgents: AgentDisplayInfo[], currentAgent?: ChannelAgentType): DingTalkCard {
  const currentAgentInfo = availableAgents.find((a) => a.type === currentAgent);
  const currentAgentName = currentAgentInfo ? `${currentAgentInfo.emoji} ${currentAgentInfo.name}` : 'None';

  const agentButtons: DingTalkButton[] = availableAgents.map((agent) => {
    const label = currentAgent === agent.type ? `[Current] ${agent.emoji} ${agent.name}` : `${agent.emoji} ${agent.name}`;
    return btn(label, 'agent.select', { agentType: agent.type });
  });

  return {
    title: 'Switch Agent',
    text: [`### Switch Agent`, '', `Select an AI agent for your conversations:`, '', `Current: **${currentAgentName}**`].join('\n'),
    btnOrientation: '0',
    btns: agentButtons,
  };
}

/**
 * Create session status card
 */
export function createSessionStatusCard(session?: { id: string; agentType: ChannelAgentType; createdAt: number; lastActivity: number }): DingTalkCard {
  if (!session) {
    return {
      title: 'Session Status',
      text: ['### Session Status', '', 'No active session.', '', 'Send a message to start a new conversation, or tap the "New Chat" button.'].join('\n'),
      btns: [btn('New Session', 'session.new')],
    };
  }

  const duration = Math.floor((Date.now() - session.createdAt) / 1000 / 60);
  const lastActivity = Math.floor((Date.now() - session.lastActivity) / 1000);

  return {
    title: 'Session Status',
    text: ['### Session Status', '', `- **Agent:** ${session.agentType}`, `- **Duration:** ${duration} min`, `- **Last activity:** ${lastActivity} sec ago`, `- **Session ID:** \`${session.id.slice(-8)}\``].join('\n'),
    btnOrientation: '1',
    btns: [btn('New Session', 'session.new'), btn('Refresh', 'session.status')],
  };
}

/**
 * Create help card
 */
export function createHelpCard(): DingTalkCard {
  return {
    title: '全国一体化智能终端助手帮助',
    text: ['### 全国一体化智能终端助手帮助', '', '一个远程助手，可通过钉钉与 全国一体化智能终端 进行交互。', '', '**常用操作：**', '- 新聊天 - 开始新会话', '- 智能体 - 切换 AI 智能体', '- 状态 - 查看当前会话状态', '- 帮助 - 显示此帮助消息', '', '发送消息即可与 AI 助手聊天。'].join('\n'),
    btnOrientation: '0',
    btns: [btn('Features', 'help.features'), btn('Pairing Guide', 'help.pairing'), btn('Tips', 'help.tips')],
  };
}

/**
 * Create features card
 */
export function createFeaturesCard(): DingTalkCard {
  return {
    title: 'Features',
    text: ['### Features', '', '**AI Chat**', '- Natural language conversation', '- Streaming output, real-time display', '- Context memory support', '', '**Session Management**', '- Single session mode', '- Clear context anytime', '- View session status', '', '**Message Actions**', '- Copy reply content', '- Regenerate reply', '- Continue conversation'].join('\n'),
    btns: [btn('Back to Help', 'help.show')],
  };
}

/**
 * Create pairing guide card
 */
export function createPairingGuideCard(): DingTalkCard {
  return {
    title: '配对指南',
    text: ['### 配对指南', '', '**首次设置：**', '1. 向机器人发送任意消息', '2. 机器人显示配对码', '3. 在 全国一体化智能终端 设置中批准配对', '4. 配对完成后即可使用', '', '**注意事项：**', '- 配对码有效期 10 分钟', '- 全国一体化智能终端 App 必须处于运行状态', '- 一个钉钉账号只能配对一次'].join('\n'),
    btns: [btn('Back to Help', 'help.show')],
  };
}

/**
 * Create tips card
 */
export function createTipsCard(): DingTalkCard {
  return {
    title: 'Tips',
    text: ['### Tips', '', '**Effective Conversations:**', '- Be clear and specific', '- Feel free to ask follow-ups', '- Regenerate if not satisfied', '', '**Quick Actions:**', '- Use card buttons for quick access', '- Tap message buttons for actions', '- New chat clears history context'].join('\n'),
    btns: [btn('Back to Help', 'help.show')],
  };
}

/**
 * Create response actions card
 * Buttons attached to AI response messages
 */
export function createResponseActionsCard(text: string): DingTalkCard {
  return {
    title: 'Response',
    text: text + '\n\n---',
    btnOrientation: '1',
    btns: [btn('Copy', 'chat.copy'), btn('Regenerate', 'chat.regenerate'), btn('Continue', 'chat.continue')],
  };
}

/**
 * Create error recovery card
 */
export function createErrorRecoveryCard(errorMessage?: string): DingTalkCard {
  return {
    title: 'Error',
    text: ['### Error', '', errorMessage || 'An error occurred. Please try again.'].join('\n'),
    btnOrientation: '1',
    btns: [btn('Retry', 'error.retry'), btn('New Session', 'session.new')],
  };
}

/**
 * Create tool confirmation card
 */
export function createToolConfirmationCard(callId: string, title: string, description: string, options: Array<{ label: string; value: string }>): DingTalkCard {
  const buttons: DingTalkButton[] = options.map((opt) => btn(opt.label, 'system.confirm', { callId, value: opt.value }));

  return {
    title,
    text: description,
    btnOrientation: '0',
    btns: buttons,
  };
}

/**
 * Create settings card
 */
export function createSettingsCard(): DingTalkCard {
  return {
    title: '设置',
    text: ['### 设置', '', '渠道设置需要在 全国一体化智能终端 App 中配置。', '', '打开 全国一体化智能终端 > WebUI > 渠道'].join('\n'),
    btns: [btn('Back', 'help.show')],
  };
}

// ==================== Utilities ====================

/**
 * Create a simple text card without buttons
 */
export function createTextCard(text: string, title?: string): DingTalkCard {
  return {
    title: title || 'Message',
    text,
  };
}
