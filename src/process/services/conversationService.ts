/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getChannelConversationName, isChannelPlatform } from '@/channels/types';
import type { ICreateConversationParams } from '@/common/ipcBridge';
import type { ConversationSource, TChatConversation } from '@/common/storage';
import { getDatabase } from '@process/database';
import path from 'path';
import { createAcpAgent } from '../initAgent';
import WorkerManage from '../WorkerManage';

/**
 * 创建会话的通用参数（基于 IPC 参数扩展）
 * Common parameters for creating conversation (extends IPC params)
 */
export interface ICreateConversationOptions extends ICreateConversationParams {
  /** 会话来源 / Conversation source */
  source?: ConversationSource;
  /** Channel chat isolation ID (e.g. user:xxx, group:xxx) */
  channelChatId?: string;
}

/**
 * 创建会话的返回结果
 * Result of creating a conversation
 */
export interface ICreateConversationResult {
  success: boolean;
  conversation?: TChatConversation;
  error?: string;
}

/**
 * 通用会话创建服务
 * Common conversation creation service
 *
 * 提供统一的会话创建逻辑，供 AionUI、Telegram 及其他 IM 使用
 * Provides unified conversation creation logic for AionUI, Telegram and other IMs
 */
export class ConversationService {
  /**
   * 创建会话（通用方法，支持所有类型）
   * Create conversation (common method, supports all types)
   */
  static async createConversation(params: ICreateConversationOptions): Promise<ICreateConversationResult> {
    const { type, extra, name, id, source } = params;

    try {
      let conversation: TChatConversation;

      if (type === 'acp') {
        conversation = await createAcpAgent(params);
      } else {
        return { success: false, error: `Invalid conversation type: ${type}. Only 'acp' is supported.` };
      }

      // Apply custom ID, name, source, and channelChatId
      if (name) {
        conversation.name = name;
      }
      if (id) {
        conversation.id = id;
      }
      if (source) {
        conversation.source = source;
      }
      if (params.channelChatId) {
        conversation.channelChatId = params.channelChatId;
      }

      // Save to database
      const db = getDatabase();
      const result = db.createConversation(conversation);
      if (!result.success) {
        console.error('[ConversationService] Failed to create conversation in database:', result.error);
        return { success: false, error: result.error };
      }

      // Register with WorkerManage after DB save so early emitted messages can be persisted reliably.
      // Note: Don't call initAgent() here - let it be lazy initialized when sendMessage() is called.
      WorkerManage.buildConversation(conversation);

      console.log(`[ConversationService] Created ${type} conversation ${conversation.id} with source=${source || 'aionui'}`);
      return { success: true, conversation };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[ConversationService] Failed to create conversation:', error);
      console.error('[ConversationService] Error details:', {
        type: params.type,
        hasModel: !!params.model,
        hasWorkspace: !!params.extra?.workspace,
        error: errorMessage,
        stack: errorStack,
      });
      return { success: false, error: `Failed to create ${params.type} conversation: ${errorMessage}` };
    }
  }

  /**
   * 获取或创建指定渠道的会话
   * Get or create a conversation for the specified channel
   *
   * 优先复用最后一个对应 source 的会话，没有则创建新会话
   * Prefers reusing the latest conversation with matching source, creates new if none exists
   */
  static async getOrCreateChannelConversation(params: ICreateConversationOptions & { source: ConversationSource; backend?: string }): Promise<ICreateConversationResult> {
    const db = getDatabase();
    const source = params.source;
    const backend = params.backend || params.extra?.backend || 'claude';

    // Per-chat lookup: find existing conversation by source + channelChatId + type, or create new
    if (params.channelChatId) {
      const latestConv = db.findChannelConversation(source, params.channelChatId, 'acp');
      if (latestConv.success && latestConv.data) {
        console.log(`[ConversationService] Reusing existing ${source} conversation for chatId=${params.channelChatId}: ${latestConv.data.id}`);
        return { success: true, conversation: latestConv.data };
      }
    }

    // No channelChatId or no existing conversation found — always create new
    return this.createConversation({
      ...params,
      type: 'acp',
      source,
      extra: {
        ...params.extra,
        backend,
      },
      name: params.name || (isChannelPlatform(source) ? getChannelConversationName(source, 'acp', backend, params.channelChatId) : `${source} Assistant`),
    });
  }
}

// Export convenience functions
export const createConversation = ConversationService.createConversation.bind(ConversationService);
export const getOrCreateChannelConversation = ConversationService.getOrCreateChannelConversation.bind(ConversationService);
