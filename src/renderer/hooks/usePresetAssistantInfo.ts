/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TChatConversation } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import CoworkLogo from '@/renderer/assets/cowork.svg';
import useSWR from 'swr';

export interface PresetAssistantInfo {
  name: string;
  logo: string;
  isEmoji: boolean;
}

/**
 * 从 conversation extra 中解析预设助手 ID
 * Resolve preset assistant ID from conversation extra
 *
 * 处理向后兼容：
 * - presetAssistantId: 新格式 'builtin-xxx'
 * - customAgentId: ACP 会话的旧格式
 * - enabledSkills: Gemini Cowork 会话的旧格式
 */
function resolvePresetId(conversation: TChatConversation): string | null {
  const extra = conversation.extra as {
    presetAssistantId?: unknown;
    customAgentId?: unknown;
    enabledSkills?: unknown;
  };
  const presetAssistantId = typeof extra?.presetAssistantId === 'string' ? extra.presetAssistantId.trim() : '';
  const customAgentId = typeof extra?.customAgentId === 'string' ? extra.customAgentId.trim() : '';
  const enabledSkills = Array.isArray(extra?.enabledSkills) ? extra.enabledSkills : [];

  // 1. 优先使用 presetAssistantId（新会话）
  // Priority: use presetAssistantId (new conversations)
  if (presetAssistantId) {
    const resolved = presetAssistantId.replace('builtin-', '');
    return resolved;
  }

  // 2. 向后兼容：customAgentId（ACP/Codex 旧会话）
  // Backward compatible: customAgentId (ACP/Codex old conversations)
  if (customAgentId) {
    const resolved = customAgentId.replace('builtin-', '');
    return resolved;
  }

  // 3. 向后兼容：enabledSkills 存在说明是 Cowork 会话（Gemini 旧会话）
  // Backward compatible: enabledSkills means Cowork conversation (Gemini old conversations)
  // 只有在既没有 presetAssistantId 也没有 customAgentId 时才使用此逻辑
  // Only use this logic when both presetAssistantId and customAgentId are absent (including empty strings)
  if (conversation.type === 'gemini' && !presetAssistantId && !customAgentId && enabledSkills.length > 0) {
    return 'cowork';
  }

  return null;
}

/**
 * 获取预设助手信息的 Hook
 * Hook to get preset assistant info from conversation
 *
 * @param conversation - 会话对象 / Conversation object
 * @returns 预设助手信息或 null / Preset assistant info or null
 */
export function usePresetAssistantInfo(conversation: TChatConversation | undefined): {
  info: PresetAssistantInfo | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();

  // Fetch custom agents to support custom preset assistants
  const { data: customAgents, isLoading: isLoadingCustomAgents } = useSWR('acp.customAgents', () => ConfigStorage.get('acp.customAgents'));

  return useMemo(() => {
    if (!conversation) return { info: null, isLoading: false };

    const presetId = resolvePresetId(conversation);
    if (!presetId) return { info: null, isLoading: false };

    // Custom agents data still loading — don't fall through to fallback yet
    if (isLoadingCustomAgents) return { info: null as PresetAssistantInfo | null, isLoading: true };

    // Find agent in custom agents list
    if (customAgents && Array.isArray(customAgents)) {
      const customAgent = customAgents.find((agent) => agent.id === presetId || agent.id === `builtin-${presetId}`);
      if (customAgent) {
        const locale = i18n.language || 'en-US';
        const resolveLocaleKey = (lang: string) => {
          if (lang.startsWith('zh')) return 'zh-CN';
          return 'en-US';
        };
        const localeKey = resolveLocaleKey(locale);

        // Handle avatar: could be emoji or svg filename
        const avatar = typeof customAgent.avatar === 'string' ? customAgent.avatar : '';
        let logo = avatar || '🤖';
        let isEmoji = true;

        if (avatar) {
          if (avatar.endsWith('.svg')) {
            isEmoji = false;
            // For cowork.svg, use the imported logo; for others, use emoji fallback
            if (avatar === 'cowork.svg') {
              logo = CoworkLogo;
            } else {
              // Other svgs not yet supported, fallback to emoji
              logo = '🤖';
              isEmoji = true;
            }
          } else {
            // It's an emoji
            logo = customAgent.avatar;
          }
        }

        return {
          info: {
            name: customAgent.nameI18n?.[localeKey] || customAgent.name || presetId,
            logo,
            isEmoji,
          },
          isLoading: false,
        };
      }
    }

    return { info: null, isLoading: false };
  }, [conversation, i18n.language, customAgents, isLoadingCustomAgents]);
}
