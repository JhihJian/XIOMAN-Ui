/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlatformNotification } from '@/common/types/platformTypes';
import { ArrowRight, Down, Up } from '@icon-park/react';
import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from './index.module.css';

interface NotificationItemProps {
  notification: PlatformNotification;
  onRead: (notificationId: string) => void | Promise<void>;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRead }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const timeAgo = useMemo(() => {
    const createdAt = new Date(notification.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return t('notification.justNow', { defaultValue: 'Just now' });
    }
    if (diffMinutes < 60) {
      return t('notification.minutesAgo', { count: diffMinutes, defaultValue: `${diffMinutes} minutes ago` });
    }
    if (diffHours < 24) {
      return t('notification.hoursAgo', { count: diffHours, defaultValue: `${diffHours} hours ago` });
    }
    if (diffDays < 7) {
      return t('notification.daysAgo', { count: diffDays, defaultValue: `${diffDays} days ago` });
    }
    return createdAt.toLocaleDateString();
  }, [notification.created_at, t]);

  const handleNavigate = () => {
    if (notification.related_agent_id) {
      void onRead(notification.id);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate is synchronous
      navigate('/guid', { state: { agentId: notification.related_agent_id } });
    }
  };

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const hasLongContent = notification.content.length > 100;

  return (
    <div className={`${styles.item} ${!notification.read ? styles.itemUnread : ''}`}>
      <div className={styles.itemHeader}>
        <span className={styles.itemTitle}>{notification.title}</span>
        <span className={styles.itemTime}>{timeAgo}</span>
      </div>
      <div className={`${styles.itemContent} ${!expanded && hasLongContent ? styles.itemContentClamped : ''}`} onClick={hasLongContent ? handleToggleExpand : undefined} style={hasLongContent ? { cursor: 'pointer' } : undefined}>
        {notification.content}
      </div>
      {hasLongContent && (
        <button type='button' className={styles.expandButton} onClick={handleToggleExpand}>
          {expanded ? (
            <>
              <span>{t('notification.collapse', { defaultValue: 'Collapse' })}</span>
              <Up theme='outline' size={14} fill='currentColor' />
            </>
          ) : (
            <>
              <span>{t('notification.expand', { defaultValue: 'View details' })}</span>
              <Down theme='outline' size={14} fill='currentColor' />
            </>
          )}
        </button>
      )}
      {notification.related_agent_id && (
        <div className={styles.itemFooter}>
          <button type='button' className={styles.itemAction} onClick={() => void handleNavigate()}>
            <span>{t('notification.goToConversation', { defaultValue: 'Go to conversation' })}</span>
            <ArrowRight theme='outline' size={14} fill='currentColor' />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationItem;
