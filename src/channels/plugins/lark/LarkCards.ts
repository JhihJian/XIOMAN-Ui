/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelAgentType } from '../../types';

/**
 * Lark Message Cards for Personal Assistant
 *
 * Lark uses interactive message cards instead of keyboard buttons.
 * Cards support markdown content, buttons, and various interactive elements.
 *
 * Card Structure:
 * - config: Card configuration (wide_screen_mode, etc.)
 * - header: Optional card header with title
 * - elements: Array of content elements (markdown, buttons, dividers, etc.)
 */

// ==================== Types ====================

/**
 * Lark card structure
 */
export interface LarkCard {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
  header?: {
    title: {
      tag: 'plain_text';
      content: string;
    };
    template?: 'blue' | 'wathet' | 'turquoise' | 'green' | 'yellow' | 'orange' | 'red' | 'carmine' | 'violet' | 'purple' | 'indigo' | 'grey';
  };
  elements: LarkCardElement[];
}

/**
 * Lark card element types
 */
export type LarkCardElement = LarkMarkdownElement | LarkDividerElement | LarkActionElement | LarkNoteElement;

export interface LarkMarkdownElement {
  tag: 'markdown';
  content: string;
}

export interface LarkDividerElement {
  tag: 'hr';
}

export interface LarkActionElement {
  tag: 'action';
  actions: LarkButtonElement[];
}

export interface LarkButtonElement {
  tag: 'button';
  text: {
    tag: 'plain_text';
    content: string;
  };
  type?: 'default' | 'primary' | 'danger';
  value: Record<string, string>;
}

export interface LarkNoteElement {
  tag: 'note';
  elements: Array<{
    tag: 'plain_text';
    content: string;
  }>;
}

// ==================== Card Builders ====================

/**
 * Agent info for card display
 */
export interface AgentDisplayInfo {
  type: ChannelAgentType;
  emoji: string;
  name: string;
}

/**
 * Create main menu card
 * Displayed after authorization or session actions
 */
export function createMainMenuCard(): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '全国一体化智能终端助手' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'markdown',
        content: '欢迎！请选择操作：',
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🆕 新聊天' },
            type: 'primary',
            value: { action: 'session.new' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔄 智能体' },
            type: 'default',
            value: { action: 'agent.show' },
          },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📊 状态' },
            type: 'default',
            value: { action: 'session.status' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '❓ 帮助' },
            type: 'default',
            value: { action: 'help.show' },
          },
        ],
      },
    ],
  };
}

/**
 * Create pairing card
 * Shown during pairing process
 */
export function createPairingCard(pairingCode: string): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🔗 需要配对' },
      template: 'yellow',
    },
    elements: [
      {
        tag: 'markdown',
        content: ['请将您的账号与 全国一体化智能终端 配对：', '', `**配对码：** \`${pairingCode}\``, '', '1. 打开 全国一体化智能终端 设置', '2. 进入 渠道 → 飞书', '3. 输入此配对码', '', '代码有效期 10 分钟。'].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔄 Refresh Code' },
            type: 'primary',
            value: { action: 'pairing.refresh' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '❓ Help' },
            type: 'default',
            value: { action: 'pairing.help' },
          },
        ],
      },
    ],
  };
}

/**
 * Create pairing status card
 * Shows waiting for approval status with code
 */
export function createPairingStatusCard(pairingCode: string): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '⏳ 等待批准' },
      template: 'orange',
    },
    elements: [
      {
        tag: 'markdown',
        content: ['您的配对请求待批准。', '', `**配对码：** \`${pairingCode}\``, '', '请在 全国一体化智能终端 设置中批准：', '1. 打开 全国一体化智能终端 App', '2. 进入 WebUI → 渠道', '3. 点击此代码的"批准"按钮'].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔄 Check Status' },
            type: 'primary',
            value: { action: 'pairing.check' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔁 New Code' },
            type: 'default',
            value: { action: 'pairing.refresh' },
          },
        ],
      },
    ],
  };
}

/**
 * Create pairing help card
 * Shows detailed pairing instructions
 */
export function createPairingHelpCard(): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '❓ 配对帮助' },
      template: 'turquoise',
    },
    elements: [
      {
        tag: 'markdown',
        content: ['**什么是配对？**', '配对将您的飞书账号与本地 全国一体化智能终端 应用程序关联。', '使用 AI 助手前需要先配对。', '', '**如何配对：**', '1. 向此机器人发送任意消息', '2. 您将收到一个配对码', '3. 打开 全国一体化智能终端 桌面 App', '4. 进入 WebUI → 渠道 → 飞书', '5. 点击您的代码的"批准"按钮', '', '**常见问题：**', '• 配对码有效期 10 分钟', '• 全国一体化智能终端 App 必须处于运行状态', '• 一个账号只能配对一次'].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔗 Get Pairing Code' },
            type: 'primary',
            value: { action: 'pairing.show' },
          },
        ],
      },
    ],
  };
}

/**
 * Create agent selection card
 * Shows available agents with current selection marked
 */
export function createAgentSelectionCard(availableAgents: AgentDisplayInfo[], currentAgent?: ChannelAgentType): LarkCard {
  const agentButtons: LarkButtonElement[] = availableAgents.map((agent) => ({
    tag: 'button',
    text: {
      tag: 'plain_text',
      content: currentAgent === agent.type ? `✓ ${agent.emoji} ${agent.name}` : `${agent.emoji} ${agent.name}`,
    },
    type: currentAgent === agent.type ? 'primary' : 'default',
    value: { action: 'agent.select', agentType: agent.type },
  }));

  // Split buttons into rows of 2
  const actionRows: LarkActionElement[] = [];
  for (let i = 0; i < agentButtons.length; i += 2) {
    actionRows.push({
      tag: 'action',
      actions: agentButtons.slice(i, i + 2),
    });
  }

  const currentAgentInfo = availableAgents.find((a) => a.type === currentAgent);
  const currentAgentName = currentAgentInfo ? `${currentAgentInfo.emoji} ${currentAgentInfo.name}` : 'None';

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🔄 Switch Agent' },
      template: 'indigo',
    },
    elements: [
      {
        tag: 'markdown',
        content: `Select an AI agent for your conversations:\n\nCurrent: **${currentAgentName}**`,
      },
      ...actionRows,
    ],
  };
}

/**
 * Create session status card
 */
export function createSessionStatusCard(session?: { id: string; agentType: ChannelAgentType; createdAt: number; lastActivity: number }): LarkCard {
  if (!session) {
    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '📊 Session Status' },
        template: 'grey',
      },
      elements: [
        {
          tag: 'markdown',
          content: 'No active session.\n\nSend a message to start a new conversation, or tap the "New Chat" button.',
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🆕 New Session' },
              type: 'primary',
              value: { action: 'session.new' },
            },
          ],
        },
      ],
    };
  }

  const duration = Math.floor((Date.now() - session.createdAt) / 1000 / 60);
  const lastActivity = Math.floor((Date.now() - session.lastActivity) / 1000);

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '📊 Session Status' },
      template: 'green',
    },
    elements: [
      {
        tag: 'markdown',
        content: [`🤖 **Agent:** ${session.agentType}`, `⏱ **Duration:** ${duration} min`, `📝 **Last activity:** ${lastActivity} sec ago`, `🔖 **Session ID:** \`${session.id.slice(-8)}\``].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🆕 New Session' },
            type: 'default',
            value: { action: 'session.new' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📊 Refresh' },
            type: 'default',
            value: { action: 'session.status' },
          },
        ],
      },
    ],
  };
}

/**
 * Create help menu card
 */
export function createHelpCard(): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '❓ 全国一体化智能终端助手帮助' },
      template: 'turquoise',
    },
    elements: [
      {
        tag: 'markdown',
        content: ['一个远程助手，可通过飞书与 全国一体化智能终端 进行交互。', '', '**常用操作：**', '• 🆕 新聊天 - 开始新会话', '• 🔄 智能体 - 切换 AI 智能体', '• 📊 状态 - 查看当前会话状态', '• ❓ 帮助 - 显示此帮助消息', '', '发送消息即可与 AI 助手聊天。'].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🤖 Features' },
            type: 'default',
            value: { action: 'help.features' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔗 Pairing Guide' },
            type: 'default',
            value: { action: 'help.pairing' },
          },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '💬 Tips' },
            type: 'default',
            value: { action: 'help.tips' },
          },
        ],
      },
    ],
  };
}

/**
 * Create features card
 */
export function createFeaturesCard(): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🤖 Features' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'markdown',
        content: ['**AI Chat**', '• Natural language conversation', '• Streaming output, real-time display', '• Context memory support', '', '**Session Management**', '• Single session mode', '• Clear context anytime', '• View session status', '', '**Message Actions**', '• Copy reply content', '• Regenerate reply', '• Continue conversation'].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '← Back to Help' },
            type: 'default',
            value: { action: 'help.show' },
          },
        ],
      },
    ],
  };
}

/**
 * Create pairing guide card
 */
export function createPairingGuideCard(): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🔗 配对指南' },
      template: 'orange',
    },
    elements: [
      {
        tag: 'markdown',
        content: ['**首次设置：**', '1. 向机器人发送任意消息', '2. 机器人显示配对码', '3. 在 全国一体化智能终端 设置中批准配对', '4. 配对完成后即可使用', '', '**注意事项：**', '• 配对码有效期 10 分钟', '• 全国一体化智能终端 App 必须处于运行状态', '• 一个飞书账号只能配对一次'].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '← Back to Help' },
            type: 'default',
            value: { action: 'help.show' },
          },
        ],
      },
    ],
  };
}

/**
 * Create tips card
 */
export function createTipsCard(): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '💬 Tips' },
      template: 'purple',
    },
    elements: [
      {
        tag: 'markdown',
        content: ['**Effective Conversations:**', '• Be clear and specific', '• Feel free to ask follow-ups', '• Regenerate if not satisfied', '', '**Quick Actions:**', '• Use card buttons for quick access', '• Tap message buttons for actions', '• New chat clears history context'].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '← Back to Help' },
            type: 'default',
            value: { action: 'help.show' },
          },
        ],
      },
    ],
  };
}

/**
 * Create response actions card
 * Buttons attached to AI response messages
 */
export function createResponseActionsCard(text: string): LarkCard {
  return {
    config: { wide_screen_mode: true },
    elements: [
      {
        tag: 'markdown',
        content: text,
      },
      {
        tag: 'hr',
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📋 Copy' },
            type: 'default',
            value: { action: 'chat.copy' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔄 Regenerate' },
            type: 'default',
            value: { action: 'chat.regenerate' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '💬 Continue' },
            type: 'default',
            value: { action: 'chat.continue' },
          },
        ],
      },
    ],
  };
}

/**
 * Create error recovery card
 */
export function createErrorRecoveryCard(errorMessage?: string): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '⚠️ Error' },
      template: 'red',
    },
    elements: [
      {
        tag: 'markdown',
        content: errorMessage || 'An error occurred. Please try again.',
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔄 Retry' },
            type: 'primary',
            value: { action: 'error.retry' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🆕 New Session' },
            type: 'default',
            value: { action: 'session.new' },
          },
        ],
      },
    ],
  };
}

/**
 * Create tool confirmation card
 * @param callId - The tool call ID for tracking
 * @param options - Array of { label, value } options
 */
export function createToolConfirmationCard(callId: string, title: string, description: string, options: Array<{ label: string; value: string }>): LarkCard {
  const buttons: LarkButtonElement[] = options.map((opt) => ({
    tag: 'button',
    text: { tag: 'plain_text', content: opt.label },
    type: 'default',
    value: { action: 'system.confirm', callId: callId, value: opt.value },
  }));

  // Split buttons into rows of 2
  const actionRows: LarkActionElement[] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    actionRows.push({
      tag: 'action',
      actions: buttons.slice(i, i + 2),
    });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: title },
      template: 'yellow',
    },
    elements: [
      {
        tag: 'markdown',
        content: description,
      },
      ...actionRows,
    ],
  };
}

/**
 * Create confirmation card (generic)
 */
export function createConfirmationCard(message: string, confirmAction: string, cancelAction: string): LarkCard {
  return {
    config: { wide_screen_mode: true },
    elements: [
      {
        tag: 'markdown',
        content: message,
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '✅ Confirm' },
            type: 'primary',
            value: { action: confirmAction },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '❌ Cancel' },
            type: 'danger',
            value: { action: cancelAction },
          },
        ],
      },
    ],
  };
}

/**
 * Create settings card
 */
export function createSettingsCard(): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '⚙️ 设置' },
      template: 'grey',
    },
    elements: [
      {
        tag: 'markdown',
        content: ['渠道设置需要在 全国一体化智能终端 App 中配置。', '', '打开 全国一体化智能终端 → WebUI → 渠道'].join('\n'),
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '← Back' },
            type: 'default',
            value: { action: 'help.show' },
          },
        ],
      },
    ],
  };
}

// ==================== Utilities ====================

/**
 * Create a simple text card without buttons
 */
export function createTextCard(text: string, title?: string, template?: LarkCard['header']['template']): LarkCard {
  const card: LarkCard = {
    config: { wide_screen_mode: true },
    elements: [
      {
        tag: 'markdown',
        content: text,
      },
    ],
  };

  if (title) {
    card.header = {
      title: { tag: 'plain_text', content: title },
      template: template || 'blue',
    };
  }

  return card;
}

/**
 * Extract action info from card button value
 */
export function parseCardButtonValue(value: Record<string, string>): {
  action: string;
  params: Record<string, string>;
} | null {
  const action = value.action;
  if (!action) return null;

  const params: Record<string, string> = {};
  Object.entries(value).forEach(([key, val]) => {
    if (key !== 'action') {
      params[key] = val;
    }
  });

  return { action, params };
}
