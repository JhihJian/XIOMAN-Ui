/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlatformNotification } from '@/common/types/platformTypes';
import { ipcBridge } from '@/common';
import { Drawer, Button, Message } from '@arco-design/web-react';
import { Remind, CheckOne } from '@icon-park/react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import NotificationItem from './NotificationItem';
import styles from './index.module.css';

interface NotificationDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ipcBridge.platform.getNotifications.invoke();
      if (response.success && response.data) {
        setNotifications(response.data);
      }
    } catch (error) {
      console.error('[NotificationDrawer] Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void fetchNotifications();
    }
  }, [visible, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await ipcBridge.platform.markNotificationRead.invoke({ notificationId });
      if (response.success) {
        setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      }
    } catch (error) {
      console.error('[NotificationDrawer] Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      const results = await Promise.all(unreadIds.map((id) => ipcBridge.platform.markNotificationRead.invoke({ notificationId: id })));

      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        Message.success(t('notification.markAllReadSuccess', { defaultValue: 'All notifications marked as read' }));
      }
    } catch (error) {
      console.error('[NotificationDrawer] Failed to mark all notifications as read:', error);
      Message.error(t('notification.markAllReadFailed', { defaultValue: 'Failed to mark all notifications as read' }));
    }
  };

  return (
    <Drawer
      className={styles.drawer}
      placement='right'
      width={400}
      title={
        <div className={styles.headerTitle}>
          <Remind theme='outline' size={18} fill='currentColor' />
          <span>{t('notification.title', { defaultValue: 'Notifications' })}</span>
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </div>
      }
      visible={visible}
      onCancel={onClose}
      bodyStyle={{
        padding: 'var(--drawer-padding)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
      footer={
        unreadCount > 0 ? (
          <div className={styles.footer}>
            <Button type='text' icon={<CheckOne theme='outline' size={16} fill='currentColor' />} onClick={handleMarkAllAsRead}>
              {t('notification.markAllRead', { defaultValue: 'Mark all as read' })}
            </Button>
          </div>
        ) : null
      }
    >
      {loading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyText}>{t('common.loading')}</div>
        </div>
      ) : notifications.length === 0 ? (
        <div className={styles.emptyState}>
          <Remind theme='outline' size={48} strokeWidth={1.5} fill='currentColor' className={styles.emptyIcon} />
          <div className={styles.emptyText}>{t('notification.empty', { defaultValue: 'No notifications' })}</div>
        </div>
      ) : (
        <div className={styles.list}>
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onRead={handleMarkAsRead} />
          ))}
        </div>
      )}
    </Drawer>
  );
};

export default NotificationDrawer;
