/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Authentication API handlers for platform integration
 */

import { http, HttpResponse, delay } from 'msw';
import { MOCK_AUTH_CODE, mockRegisterResponse } from '../data';

/**
 * Auth API handlers
 */
export const authHandlers = [
  /**
   * POST /api/nodes/register
   * Register node with authorization code
   */
  http.post('/api/nodes/register', async ({ request }) => {
    await delay(400);

    try {
      const body = (await request.json()) as { auth_code?: string };

      if (!body?.auth_code) {
        return HttpResponse.json(
          {
            success: false,
            error: 'auth_code is required',
          },
          { status: 400 }
        );
      }

      if (body.auth_code !== MOCK_AUTH_CODE) {
        return HttpResponse.json(
          {
            success: false,
            error: 'Invalid authorization code',
          },
          { status: 401 }
        );
      }

      return HttpResponse.json({
        success: true,
        data: mockRegisterResponse,
      });
    } catch {
      return HttpResponse.json(
        {
          success: false,
          error: 'Invalid request body',
        },
        { status: 400 }
      );
    }
  }),

  /**
   * GET /api/nodes/auth-check
   * Verify token validity
   */
  http.get('/api/nodes/auth-check', async ({ request }) => {
    await delay(200);

    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Missing or invalid Authorization header',
        },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // For mock, accept the mock token or any non-empty token
    if (!token) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Invalid token',
        },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        valid: true,
        node_id: mockRegisterResponse.node_id,
        expires_at: mockRegisterResponse.token_expires_at,
      },
    });
  }),
];
