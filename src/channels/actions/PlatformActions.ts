/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IActionContext, IActionResult, IRegisteredAction, ActionHandler } from './types';
import { PlatformActionNames, createSuccessResponse, createErrorResponse } from './types';
import { getPairingService } from '../pairing/PairingService';
import { createPairingCodeKeyboard, createPairingStatusKeyboard, createMainMenuKeyboard } from '../plugins/telegram/TelegramKeyboards';
import { createPairingCard, createPairingStatusCard, createMainMenuCard, createPairingHelpCard } from '../plugins/lark/LarkCards';
import { createMainMenuCard as createDingTalkMainMenuCard, createPairingCard as createDingTalkPairingCard, createPairingStatusCard as createDingTalkPairingStatusCard, createPairingHelpCard as createDingTalkPairingHelpCard } from '../plugins/dingtalk/DingTalkCards';

/**
 * PlatformActions - Handlers for platform-specific actions
 *
 * Supports both Telegram and Lark platforms with platform-specific UI components.
 * These actions are handled by the plugin itself, not through the Gateway.
 */

// ==================== Platform-specific Markup Helpers ====================

/**
 * Get main menu markup based on platform
 */
function getMainMenuMarkup(platform: string) {
  if (platform === 'lark') {
    return createMainMenuCard();
  }
  if (platform === 'dingtalk') {
    return createDingTalkMainMenuCard();
  }
  return createMainMenuKeyboard();
}

/**
 * Get pairing code markup based on platform
 */
function getPairingCodeMarkup(platform: string, code: string) {
  if (platform === 'lark') {
    return createPairingCard(code);
  }
  if (platform === 'dingtalk') {
    return createDingTalkPairingCard(code);
  }
  return createPairingCodeKeyboard();
}

/**
 * Get pairing status markup based on platform
 */
function getPairingStatusMarkup(platform: string, code: string) {
  if (platform === 'lark') {
    return createPairingStatusCard(code);
  }
  if (platform === 'dingtalk') {
    return createDingTalkPairingStatusCard(code);
  }
  return createPairingStatusKeyboard();
}

/**
 * Get pairing help markup based on platform
 */
function getPairingHelpMarkup(platform: string) {
  if (platform === 'lark') {
    return createPairingHelpCard();
  }
  if (platform === 'dingtalk') {
    return createDingTalkPairingHelpCard();
  }
  return createPairingCodeKeyboard();
}

/**
 * Handle pairing.show - Show pairing code to user
 * Called when user sends /start or first message
 */
export const handlePairingShow: ActionHandler = async (context) => {
  const pairingService = getPairingService();
  const platform = context.platform;

  // Check if user is already authorized
  if (pairingService.isUserAuthorized(context.userId, platform)) {
    return createSuccessResponse({
      type: 'text',
      text: ['✅ <b>Authorized</b>', '', 'Your account is already paired and ready to use.', '', 'Send a message to start chatting, or use the buttons below.'].join('\n'),
      parseMode: 'HTML',
      replyMarkup: getMainMenuMarkup(platform),
    });
  }

  // Generate pairing code
  try {
    const { code, expiresAt } = await pairingService.generatePairingCode(context.userId, platform, context.displayName);

    const expiresInMinutes = Math.ceil((expiresAt - Date.now()) / 1000 / 60);

    return createSuccessResponse({
      type: 'text',
      text: ['🔗 <b>设备配对</b>', '', '请在 全国一体化智能终端 App 中批准此配对请求：', '', `<code>${code}</code>`, '', `⏱ 有效期：${expiresInMinutes} 分钟`, '', '<b>步骤：</b>', '1. 打开 全国一体化智能终端 App', '2. 进入 WebUI → 渠道', '3. 点击"批准"待处理的配对请求'].join('\n'),
      parseMode: 'HTML',
      replyMarkup: getPairingCodeMarkup(platform, code),
    });
  } catch (error: any) {
    return createErrorResponse(`Failed to generate pairing code: ${error.message}`);
  }
};

/**
 * Handle pairing.refresh - Refresh pairing code
 */
export const handlePairingRefresh: ActionHandler = async (context) => {
  const pairingService = getPairingService();
  const platform = context.platform;

  // Check if user is already authorized
  if (pairingService.isUserAuthorized(context.userId, platform)) {
    return createSuccessResponse({
      type: 'text',
      text: '✅ You are already paired. No need to refresh the pairing code.',
      parseMode: 'HTML',
      replyMarkup: getMainMenuMarkup(platform),
    });
  }

  // Generate new pairing code
  try {
    const { code, expiresAt } = await pairingService.refreshPairingCode(context.userId, platform, context.displayName);

    const expiresInMinutes = Math.ceil((expiresAt - Date.now()) / 1000 / 60);

    return createSuccessResponse({
      type: 'text',
      text: ['🔄 <b>新配对码</b>', '', `<code>${code}</code>`, '', `⏱ 有效期：${expiresInMinutes} 分钟`, '', '请在 全国一体化智能终端 设置中批准此配对请求。'].join('\n'),
      parseMode: 'HTML',
      replyMarkup: getPairingCodeMarkup(platform, code),
    });
  } catch (error: any) {
    return createErrorResponse(`Failed to refresh pairing code: ${error.message}`);
  }
};

/**
 * Handle pairing.check - Check pairing status
 */
export const handlePairingCheck: ActionHandler = async (context) => {
  const pairingService = getPairingService();
  const platform = context.platform;

  // Check if user is already authorized
  if (pairingService.isUserAuthorized(context.userId, platform)) {
    return createSuccessResponse({
      type: 'text',
      text: ['✅ <b>Pairing Successful!</b>', '', 'Your account is now paired and ready to use.', '', 'Send a message to chat with the AI assistant.'].join('\n'),
      parseMode: 'HTML',
      replyMarkup: getMainMenuMarkup(platform),
    });
  }

  // Check for pending request
  const pendingRequest = pairingService.getPendingRequestForUser(context.userId, platform);

  if (pendingRequest) {
    const expiresInMinutes = Math.ceil((pendingRequest.expiresAt - Date.now()) / 1000 / 60);

    return createSuccessResponse({
      type: 'text',
      text: ['⏳ <b>等待批准</b>', '', `配对码：<code>${pendingRequest.code}</code>`, `剩余时间：${expiresInMinutes} 分钟`, '', '请在 全国一体化智能终端 设置中批准配对请求。'].join('\n'),
      parseMode: 'HTML',
      replyMarkup: getPairingStatusMarkup(platform, pendingRequest.code),
    });
  }

  // No pending request - need to generate new code
  return handlePairingShow(context);
};

/**
 * Handle pairing.help - Show pairing help
 */
export const handlePairingHelp: ActionHandler = async (context) => {
  const platform = context.platform;
  const platformName = platform === 'lark' ? 'Lark/Feishu' : platform === 'dingtalk' ? 'DingTalk' : 'Telegram';

  return createSuccessResponse({
    type: 'text',
    text: ['❓ <b>配对帮助</b>', '', '<b>什么是配对？</b>', `配对将您的 ${platformName} 账号与本地 全国一体化智能终端 应用程序关联。`, '使用 AI 助手前需要先配对。', '', '<b>配对步骤：</b>', '1. 获取配对码（发送任意消息）', '2. 打开 全国一体化智能终端 App', '3. 进入 WebUI → 渠道', '4. 点击"批准"待处理请求', '', '<b>常见问题：</b>', '• 配对码有效期 10 分钟，如过期请刷新', '• 全国一体化智能终端 App 必须处于运行状态', '• 确保网络连接稳定'].join('\n'),
    parseMode: 'HTML',
    replyMarkup: getPairingHelpMarkup(platform),
  });
};

/**
 * All platform actions
 */
export const platformActions: IRegisteredAction[] = [
  {
    name: PlatformActionNames.PAIRING_SHOW,
    category: 'platform',
    description: 'Show pairing code',
    handler: handlePairingShow,
  },
  {
    name: PlatformActionNames.PAIRING_REFRESH,
    category: 'platform',
    description: 'Refresh pairing code',
    handler: handlePairingRefresh,
  },
  {
    name: PlatformActionNames.PAIRING_CHECK,
    category: 'platform',
    description: 'Check pairing status',
    handler: handlePairingCheck,
  },
  {
    name: PlatformActionNames.PAIRING_HELP,
    category: 'platform',
    description: 'Show pairing help',
    handler: handlePairingHelp,
  },
];
