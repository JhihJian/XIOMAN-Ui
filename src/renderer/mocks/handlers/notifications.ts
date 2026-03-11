/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Notifications API handlers for platform integration
 */

import { http, HttpResponse, delay } from 'msw';
import { mockNotifications } from '../data';

/**
 * Notifications API handlers
 */
export const notificationsHandlers = [
  /**
   * GET /api/nodes/notifications
   * Get list of platform notifications
   */
  http.get('/api/nodes/notifications', async ({ request }) => {
    await delay(500);

    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread_only') === 'true';

    let notifications = [...mockNotifications];

    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }

    return HttpResponse.json({
      success: true,
      data: {
        notifications,
        total: notifications.length,
        unread_count: mockNotifications.filter((n) => !n.read).length,
      },
    });
  }),

  /**
   * PUT /api/nodes/notifications/:id/read
   * Mark notification as read
   */
  http.put('/api/nodes/notifications/:id/read', async ({ params }) => {
    await delay(300);

    const { id } = params;
    const notification = mockNotifications.find((n) => n.id === id);

    if (!notification) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Notification not found',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        id,
        read: true,
        read_at: new Date().toISOString(),
      },
    });
  }),
];
