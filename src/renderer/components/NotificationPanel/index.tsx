/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlatformNotification } from '@/common/types/platformTypes';
import { ipcBridge } from '@/common';
import { Button, Message, Modal } from '@arco-design/web-react';
import { Remind, CheckOne, Down, Up, ArrowRight, Info, Check } from '@icon-park/react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from './index.module.css';

interface NotificationPanelProps {
  className?: string;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ className }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [detailNotification, setDetailNotification] = useState<PlatformNotification | null>(null);

  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read), [notifications]);
  const unreadCount = unreadNotifications.length;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ipcBridge.platform.getNotifications.invoke();
      if (response.success && response.data) {
        setNotifications(response.data);
      }
    } catch (error) {
      console.error('[NotificationPanel] Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await ipcBridge.platform.markNotificationRead.invoke({ notificationId });
      if (response.success) {
        setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      }
    } catch (error) {
      console.error('[NotificationPanel] Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = unreadNotifications.map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      const results = await Promise.all(unreadIds.map((id) => ipcBridge.platform.markNotificationRead.invoke({ notificationId: id })));

      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        Message.success(t('notification.markAllReadSuccess', { defaultValue: 'All notifications marked as read' }));
      }
    } catch (error) {
      console.error('[NotificationPanel] Failed to mark all notifications as read:', error);
      Message.error(t('notification.markAllReadFailed', { defaultValue: 'Failed to mark all notifications as read' }));
    }
  };

  const handleNavigate = (notification: PlatformNotification, autoSend = false) => {
    if (notification.related_agent_id) {
      void handleMarkAsRead(notification.id);
      const message = `【${notification.title}】\n${notification.content}`;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate is synchronous
      navigate('/guid', {
        state: {
          agentId: notification.related_agent_id,
          message: autoSend ? message : undefined,
        },
      });
    }
  };

  const timeAgo = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
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
    return date.toLocaleDateString();
  };

  const handleShowDetail = (e: React.MouseEvent, notification: PlatformNotification) => {
    e.stopPropagation();
    setDetailNotification(notification);
  };

  const handleMarkRead = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    void handleMarkAsRead(notificationId);
  };

  const handleStartConversation = (e: React.MouseEvent, notification: PlatformNotification) => {
    e.stopPropagation();
    handleNavigate(notification, true);
  };

  // Don't render if no notifications
  if (!loading && notifications.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`${styles.panel} ${className || ''}`}>
        <div className={styles.header} onClick={() => setExpanded((prev) => !prev)}>
          <div className={styles.headerLeft}>
            <Remind theme='filled' size={20} fill='currentColor' className={styles.icon} />
            <span className={styles.title}>{t('notification.panelTitle', { defaultValue: '工作通知' })}</span>
            {unreadCount > 0 && (
              <span className={styles.badge}>
                {unreadCount} {t('notification.unread', { defaultValue: 'unread' })}
              </span>
            )}
          </div>
          <div className={styles.headerRight}>
            {unreadCount > 0 && (
              <Button
                type='text'
                size='small'
                icon={<CheckOne theme='outline' size={14} fill='currentColor' />}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleMarkAllAsRead();
                }}
                className={styles.markAllButton}
              >
                {t('notification.markAllRead', { defaultValue: 'Mark all as read' })}
              </Button>
            )}
            <button type='button' className={styles.toggleButton}>
              {expanded ? <Up theme='outline' size={16} fill='currentColor' /> : <Down theme='outline' size={16} fill='currentColor' />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className={styles.content}>
            {loading ? (
              <div className={styles.loading}>{t('common.loading')}</div>
            ) : (
              <div className={styles.list}>
                {notifications.slice(0, 5).map((notification) => (
                  <div key={notification.id} className={`${styles.itemRow} ${!notification.read ? styles.itemUnread : ''}`}>
                    <div className={styles.itemMain}>
                      <span className={styles.itemTitle}>{notification.title}</span>
                      <span className={styles.itemTime}>{timeAgo(notification.created_at)}</span>
                    </div>
                    <div className={styles.itemActions}>
                      {!notification.read && (
                        <Button type='text' size='small' className={styles.actionBtn} icon={<Check theme='outline' size={14} fill='currentColor' />} onClick={(e) => handleMarkRead(e, notification.id)}>
                          {t('notification.markRead', { defaultValue: '查收' })}
                        </Button>
                      )}
                      <Button type='text' size='small' className={styles.actionBtn} icon={<Info theme='outline' size={14} fill='currentColor' />} onClick={(e) => handleShowDetail(e, notification)}>
                        {t('notification.detail', { defaultValue: '详情' })}
                      </Button>
                      {notification.related_agent_id && (
                        <Button type='text' size='small' className={styles.actionBtn} icon={<ArrowRight theme='outline' size={14} fill='currentColor' />} onClick={(e) => handleStartConversation(e, notification)}>
                          {t('notification.goToConversation', { defaultValue: '开始对话' })}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className={styles.empty}>
                    <CheckOne theme='outline' size={24} fill='currentColor' className={styles.emptyIcon} />
                    <span>{t('notification.allRead', { defaultValue: 'All caught up!' })}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        title={detailNotification?.title}
        visible={!!detailNotification}
        onCancel={() => setDetailNotification(null)}
        footer={
          detailNotification?.related_agent_id ? (
            <Button
              type='primary'
              icon={<ArrowRight theme='outline' size={14} fill='currentColor' />}
              onClick={() => {
                if (detailNotification) {
                  handleNavigate(detailNotification, true);
                  setDetailNotification(null);
                }
              }}
            >
              {t('notification.goToConversation', { defaultValue: '开始对话' })}
            </Button>
          ) : null
        }
        autoFocus={false}
        focusLock={true}
      >
        {detailNotification && (
          <div className={styles.detailContent}>
            <div className={styles.detailMeta}>
              <span className={styles.detailType}>{detailNotification.type}</span>
              <span className={styles.detailTime}>{timeAgo(detailNotification.created_at)}</span>
            </div>
            <div className={styles.detailBody}>{detailNotification.content}</div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default NotificationPanel;
