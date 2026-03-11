/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlatformNotification } from '@/common/types/platformTypes';
import { ArrowRight } from '@icon-park/react';
import React, { useMemo } from 'react';
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
      void navigate('/guid', { state: { agentId: notification.related_agent_id } });
    }
  };

  return (
    <div className={`${styles.item} ${!notification.read ? styles.itemUnread : ''}`}>
      <div className={styles.itemHeader}>
        <span className={styles.itemTitle}>{notification.title}</span>
        <span className={styles.itemTime}>{timeAgo}</span>
      </div>
      <div className={styles.itemContent}>{notification.content}</div>
      {notification.related_agent_id && (
        <div className={styles.itemFooter}>
          <button type='button' className={styles.itemAction} onClick={handleNavigate}>
            <span>{t('notification.goToConversation', { defaultValue: 'Go to conversation' })}</span>
            <ArrowRight theme='outline' size={14} fill='currentColor' />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationItem;
