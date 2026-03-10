/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/storage';
import { uuid } from '@/common/utils';
import addChatIcon from '@/renderer/assets/add-chat.svg';
import { CronJobManager } from '@/renderer/pages/cron';
import { usePresetAssistantInfo } from '@/renderer/hooks/usePresetAssistantInfo';
import { iconColors } from '@/renderer/theme/colors';
import { Button, Dropdown, Menu, Tooltip, Typography } from '@arco-design/web-react';
import { History } from '@icon-park/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { emitter } from '../../utils/emitter';
import AcpChat from './acp/AcpChat';
import ChatLayout from './ChatLayout';
import ChatSider from './ChatSider';
import CodexChat from './codex/CodexChat';
import NanobotChat from './nanobot/NanobotChat';
import OpenClawChat from './openclaw/OpenClawChat';
import AcpModelSelector from '@/renderer/components/AcpModelSelector';

const _AssociatedConversation: React.FC<{ conversation_id: string }> = ({ conversation_id }) => {
  const { data } = useSWR(['getAssociateConversation', conversation_id], () => ipcBridge.conversation.getAssociateConversation.invoke({ conversation_id }));
  const navigate = useNavigate();
  const list = useMemo(() => {
    if (!data?.length) return [];
    return data.filter((conversation) => conversation.id !== conversation_id);
  }, [data]);
  if (!list.length) return null;
  return (
    <Dropdown
      droplist={
        <Menu
          onClickMenuItem={(key) => {
            Promise.resolve(navigate(`/conversation/${key}`)).catch((error) => {
              console.error('Navigation failed:', error);
            });
          }}
        >
          {list.map((conversation) => {
            return (
              <Menu.Item key={conversation.id}>
                <Typography.Ellipsis className={'max-w-300px'}>{conversation.name}</Typography.Ellipsis>
              </Menu.Item>
            );
          })}
        </Menu>
      }
      trigger={['click']}
    >
      <Button size='mini' icon={<History theme='filled' size='14' fill={iconColors.primary} strokeWidth={2} strokeLinejoin='miter' strokeLinecap='square' />}></Button>
    </Dropdown>
  );
};

const _AddNewConversation: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!conversation.extra?.workspace) return null;
  return (
    <Tooltip content={t('conversation.workspace.createNewConversation')}>
      <Button
        size='mini'
        icon={<img src={addChatIcon} alt='Add chat' className='w-14px h-14px block m-auto' />}
        onClick={async () => {
          const id = uuid();
          // Fetch latest conversation from DB to ensure sessionMode is current
          const latest = await ipcBridge.conversation.get.invoke({ id: conversation.id }).catch((): null => null);
          const source = latest || conversation;
          ipcBridge.conversation.createWithConversation
            .invoke({ conversation: { ...source, id, createTime: Date.now(), modifyTime: Date.now() } })
            .then(() => {
              Promise.resolve(navigate(`/conversation/${id}`)).catch((error) => {
                console.error('Navigation failed:', error);
              });
              emitter.emit('chat.history.refresh');
            })
            .catch((error) => {
              console.error('Failed to create conversation:', error);
            });
        }}
      />
    </Tooltip>
  );
};

const ChatConversation: React.FC<{
  conversation?: TChatConversation;
}> = ({ conversation }) => {
  const { t } = useTranslation();
  const workspaceEnabled = Boolean(conversation?.extra?.workspace);

  const conversationNode = useMemo(() => {
    if (!conversation) return null;
    switch (conversation.type) {
      case 'acp':
        return <AcpChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} backend={conversation.extra?.backend || 'claude'} sessionMode={conversation.extra?.sessionMode}></AcpChat>;
      case 'codex': // Legacy: new Codex conversations use ACP protocol. Kept for existing sessions.
        return <CodexChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} />;
      case 'openclaw-gateway':
        return <OpenClawChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} />;
      case 'nanobot':
        return <NanobotChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} />;
      default:
        return null;
    }
  }, [conversation]);

  // 使用统一的 Hook 获取预设助手信息（ACP/Codex 会话）
  // Use unified hook for preset assistant info (ACP/Codex conversations)
  const { info: presetAssistantInfo, isLoading: isLoadingPreset } = usePresetAssistantInfo(conversation);

  const sliderTitle = useMemo(() => {
    return (
      <div className='flex items-center justify-between'>
        <span className='text-16px font-bold text-t-primary'>{t('conversation.workspace.title')}</span>
      </div>
    );
  }, [t]);

  // For ACP/Codex conversations, use AcpModelSelector that can show/switch models.
  const modelSelector = useMemo(() => {
    if (!conversation) return undefined;
    if (conversation.type === 'acp') {
      const extra = conversation.extra as { backend?: string; currentModelId?: string };
      return <AcpModelSelector conversationId={conversation.id} backend={extra.backend} initialModelId={extra.currentModelId} />;
    }
    if (conversation.type === 'codex') {
      return <AcpModelSelector conversationId={conversation.id} />;
    }
    return undefined;
  }, [conversation]);

  // 如果有预设助手信息,使用预设助手的 logo 和名称；加载中时不进入 fallback；否则使用 backend 的 logo
  // If preset assistant info exists, use preset logo/name; while loading, avoid fallback; otherwise use backend logo
  const chatLayoutProps = presetAssistantInfo
    ? {
        agentName: presetAssistantInfo.name,
        agentLogo: presetAssistantInfo.logo,
        agentLogoIsEmoji: presetAssistantInfo.isEmoji,
      }
    : isLoadingPreset
      ? {} // Still loading custom agents — avoid showing backend logo prematurely
      : {
          backend: conversation?.type === 'acp' ? conversation?.extra?.backend : conversation?.type === 'codex' ? 'codex' : conversation?.type === 'openclaw-gateway' ? 'openclaw-gateway' : conversation?.type === 'nanobot' ? 'nanobot' : undefined,
          agentName: (conversation?.extra as { agentName?: string })?.agentName,
        };

  return (
    <ChatLayout title={conversation?.name} {...chatLayoutProps} headerLeft={modelSelector} headerExtra={conversation ? <CronJobManager conversationId={conversation.id} /> : undefined} siderTitle={sliderTitle} sider={<ChatSider conversation={conversation} />} workspaceEnabled={workspaceEnabled} conversationId={conversation?.id}>
      {conversationNode}
    </ChatLayout>
  );
};

export default ChatConversation;
