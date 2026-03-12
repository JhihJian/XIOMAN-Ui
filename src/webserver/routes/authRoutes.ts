/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Express, Request, Response } from 'express';
import { AuthService } from '@/webserver/auth/service/AuthService';
import { AuthMiddleware } from '@/webserver/auth/middleware/AuthMiddleware';
import { UserRepository } from '@/webserver/auth/repository/UserRepository';
import { AUTH_CONFIG, getCookieOptions } from '../config/constants';
import { TokenUtils } from '@/webserver/auth/middleware/TokenMiddleware';
import { createAppError } from '../middleware/errorHandler';
import { authRateLimiter, authenticatedActionLimiter, apiRateLimiter } from '../middleware/security';
import { verifyQRTokenDirect } from '@/process/bridge/webuiBridge';
import { PLATFORM_CONFIG } from '@/common/config/platformConfig';

/**
 * QR 登录页面 HTML（静态，不包含用户输入）
 * QR login page HTML (static, no user input embedded)
 * JavaScript 直接从 URL 参数读取 token，避免 XSS
 * JavaScript reads token directly from URL params to prevent XSS
 */
const QR_LOGIN_PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QR Login - AionUI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; }
    .loading { color: #3498db; font-size: 18px; }
    .success { color: #27ae60; }
    .error { color: #e74c3c; }
    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h2 { margin-bottom: 16px; }
    p { color: #666; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container" id="content">
    <div class="spinner"></div>
    <p class="loading">Verifying... / 验证中...</p>
  </div>
  <script>
    (async function() {
      var container = document.getElementById('content');
      var params = new URLSearchParams(window.location.search);
      var qrToken = params.get('token');
      if (!qrToken) {
        container.innerHTML = '<h2 class="error">Invalid QR Code</h2><p>The QR code is invalid or missing.</p><p>二维码无效或缺失。</p>';
        return;
      }
      try {
        var response = await fetch('/api/auth/qr-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrToken: qrToken }),
          credentials: 'include'
        });
        var data = await response.json();
        if (data.success) {
          container.innerHTML = '<h2 class="success">Login Successful!</h2><p>Redirecting... / 登录成功，正在跳转...</p>';
          setTimeout(function() { window.location.href = '/'; }, 1000);
        } else {
          // XSS 安全修复：使用 textContent 而非 innerHTML 插入错误消息
          // XSS Security fix: Use textContent instead of innerHTML for error message
          var h2 = document.createElement('h2');
          h2.className = 'error';
          h2.textContent = 'Login Failed';
          var p1 = document.createElement('p');
          p1.textContent = data.error || 'QR code expired or invalid';
          var p2 = document.createElement('p');
          p2.textContent = '二维码已过期或无效，请重新扫描。';
          container.innerHTML = '';
          container.appendChild(h2);
          container.appendChild(p1);
          container.appendChild(p2);
        }
      } catch (e) {
        container.innerHTML = '<h2 class="error">Error</h2><p>Network error. Please try again.</p><p>网络错误，请重试。</p>';
      }
    })();
  </script>
</body>
</html>`;

/**
 * 注册认证相关路由
 * Register authentication routes
 */
export function registerAuthRoutes(app: Express): void {
  /**
   * 用户登出 - Logout endpoint
   * POST /logout
   */
  // Authenticated endpoints reuse shared limiter keyed by user/IP
  // 已登录接口复用按用户/IP 计数的限流器
  app.post('/logout', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, (req: Request, res: Response) => {
    // 将当前 token 加入黑名单 / Blacklist current token
    const token = TokenUtils.extractFromRequest(req);
    if (token) {
      AuthService.blacklistToken(token);
    }

    res.clearCookie(AUTH_CONFIG.COOKIE.NAME);
    res.json({ success: true, message: 'Logged out successfully' });
  });

  /**
   * 获取认证状态 - Get authentication status
   * GET /api/auth/status
   */
  // Rate limit auth status endpoint to prevent enumeration
  // 为认证状态端点添加速率限制以防止枚举攻击
  app.get('/api/auth/status', apiRateLimiter, (_req: Request, res: Response) => {
    try {
      const hasUsers = UserRepository.hasUsers();
      const userCount = UserRepository.countUsers();

      res.json({
        success: true,
        needsSetup: !hasUsers,
        userCount,
        isAuthenticated: false, // Will be determined by frontend based on token
      });
    } catch (error) {
      console.error('Auth status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * 获取当前用户信息 - Get current user (protected route)
   * GET /api/auth/user
   */
  // Add rate limiting for authenticated user info endpoint
  // 为已认证用户信息端点添加速率限制
  app.get('/api/auth/user', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, (req: Request, res: Response) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  /**
   * 修改密码 - Change password endpoint (protected route)
   * POST /api/auth/change-password
   */
  app.post('/api/auth/change-password', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        });
        return;
      }

      // Validate new password strength
      const passwordValidation = AuthService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          success: false,
          error: 'New password does not meet security requirements',
          details: passwordValidation.errors,
        });
        return;
      }

      // Get current user
      const user = UserRepository.findById(req.user!.id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Verify current password
      const isValidPassword = await AuthService.verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
        });
        return;
      }

      // Hash new password
      const newPasswordHash = await AuthService.hashPassword(newPassword);

      // Update password
      UserRepository.updatePassword(user.id, newPasswordHash);
      AuthService.invalidateAllTokens();

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Token 刷新 - Token refresh endpoint
   * POST /api/auth/refresh
   */
  app.post('/api/auth/refresh', apiRateLimiter, authenticatedActionLimiter, (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token is required',
        });
        return;
      }

      const newToken = AuthService.refreshToken(token);
      if (!newToken) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
        });
        return;
      }

      res.json({
        success: true,
        token: newToken,
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * 生成 WebSocket Token - Generate WebSocket token
   * GET /api/ws-token
   *
   * 注意：现在 WebSocket 直接复用主 token，此接口返回主 token 以保持向后兼容
   * Note: WebSocket now reuses the main token, this endpoint returns the main token for backward compatibility
   */
  // Rate limit WebSocket token endpoint
  // 为 WebSocket token 端点添加速率限制
  app.get('/api/ws-token', apiRateLimiter, authenticatedActionLimiter, (req: Request, res: Response, next) => {
    try {
      const sessionToken = TokenUtils.extractFromRequest(req);

      if (!sessionToken) {
        return next(createAppError('Unauthorized: Invalid or missing session', 401, 'unauthorized'));
      }

      const decoded = AuthService.verifyToken(sessionToken);
      if (!decoded) {
        return next(createAppError('Unauthorized: Invalid session token', 401, 'unauthorized'));
      }

      const user = UserRepository.findById(decoded.userId);
      if (!user) {
        return next(createAppError('Unauthorized: User not found', 401, 'unauthorized'));
      }

      // 直接返回主 token，不再生成单独的 WebSocket token
      res.json({
        success: true,
        wsToken: sessionToken, // 复用主 token
        expiresIn: AUTH_CONFIG.TOKEN.COOKIE_MAX_AGE, // 使用主 token 的过期时间
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * 二维码登录验证 - QR code login verification
   * POST /api/auth/qr-login
   */
  app.post('/api/auth/qr-login', authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { qrToken } = req.body;

      if (!qrToken) {
        res.status(400).json({
          success: false,
          error: 'QR token is required',
        });
        return;
      }

      // 获取客户端 IP（用于本地网络限制验证）
      // Get client IP (for local network restriction verification)
      const clientIP = req.ip || req.socket.remoteAddress || '';

      // 直接验证 QR token（无需 IPC）/ Verify QR token directly (no IPC)
      const result = await verifyQRTokenDirect(qrToken, clientIP);

      if (!result.success || !result.data) {
        res.status(401).json({
          success: false,
          error: result.msg || 'Invalid or expired QR token',
        });
        return;
      }

      // 设置 session cookie（远程模式下启用 secure 标志）
      // Set session cookie (enable secure flag in remote mode)
      res.cookie(AUTH_CONFIG.COOKIE.NAME, result.data.sessionToken, {
        ...getCookieOptions(),
        maxAge: AUTH_CONFIG.TOKEN.COOKIE_MAX_AGE,
      });

      res.json({
        success: true,
        user: { username: result.data.username },
        token: result.data.sessionToken,
      });
    } catch (error) {
      console.error('QR login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * 二维码登录页面 - QR code login page
   * GET /qr-login
   * 安全处理：返回静态 HTML，JavaScript 从 URL 读取 token，避免 XSS
   * Security: Return static HTML, JavaScript reads token from URL to prevent XSS
   */
  app.get('/qr-login', (_req: Request, res: Response) => {
    res.send(QR_LOGIN_PAGE_HTML);
  });

  /**
   * 授权码登录 - Authorization code login
   * POST /api/auth/code-login
   * 使用平台授权码进行登录验证
   * Use platform authorization code for login verification
   */
  app.post('/api/auth/code-login', authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { authCode } = req.body;

      if (!authCode || typeof authCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Authorization code is required',
        });
        return;
      }

      // 开发模式：使用 mock 数据 / Dev mode: use mock data
      const IS_DEV = process.env.NODE_ENV === 'development';
      const MOCK_AUTH_CODE = 'DEMO-2026';

      if (IS_DEV) {
        console.log('[Auth] Using mock data for code-login');
        if (authCode !== MOCK_AUTH_CODE) {
          res.status(401).json({
            success: false,
            error: 'Invalid authorization code',
          });
          return;
        }

        // 获取系统用户（授权码登录不需要密码验证）
        // Get system user (auth code login doesn't require password verification)
        const adminUser = UserRepository.findByUsername(AUTH_CONFIG.DEFAULT_USER.USERNAME);
        if (!adminUser) {
          res.status(500).json({
            success: false,
            error: 'System user not initialized',
          });
          return;
        }

        // 生成会话 token / Generate session token
        const sessionToken = AuthService.generateToken(adminUser);

        // 更新最后登录时间 / Update last login time
        UserRepository.updateLastLogin(adminUser.id);

        // 设置 session cookie / Set session cookie
        res.cookie(AUTH_CONFIG.COOKIE.NAME, sessionToken, {
          ...getCookieOptions(),
          maxAge: AUTH_CONFIG.TOKEN.COOKIE_MAX_AGE,
        });

        res.json({
          success: true,
          user: { username: adminUser.username },
          token: sessionToken,
        });
        return;
      }

      // 生产模式：调用平台服务器验证 / Production: call platform server to verify
      const platformUrl = PLATFORM_CONFIG.serverUrl;
      if (!platformUrl) {
        res.status(500).json({
          success: false,
          error: 'Platform server not configured',
        });
        return;
      }

      try {
        const response = await fetch(`${platformUrl}/api/nodes/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ auth_code: authCode }),
        });

        const result = (await response.json()) as {
          success: boolean;
          data?: { node_id?: string; token?: string; token_expires_at?: string };
          msg?: string;
        };

        if (!response.ok || !result.success) {
          res.status(401).json({
            success: false,
            error: result.msg || 'Invalid authorization code',
          });
          return;
        }

        // 获取系统用户（授权码登录不需要密码验证）
        // Get system user (auth code login doesn't require password verification)
        const adminUser = UserRepository.findByUsername(AUTH_CONFIG.DEFAULT_USER.USERNAME);
        if (!adminUser) {
          res.status(500).json({
            success: false,
            error: 'System user not initialized',
          });
          return;
        }

        // 生成会话 token / Generate session token
        const sessionToken = AuthService.generateToken(adminUser);

        // 更新最后登录时间 / Update last login time
        UserRepository.updateLastLogin(adminUser.id);

        // 设置 session cookie / Set session cookie
        res.cookie(AUTH_CONFIG.COOKIE.NAME, sessionToken, {
          ...getCookieOptions(),
          maxAge: AUTH_CONFIG.TOKEN.COOKIE_MAX_AGE,
        });

        res.json({
          success: true,
          user: { username: adminUser.username, nodeId: result.data?.node_id },
          token: sessionToken,
        });
      } catch (fetchError) {
        console.error('[Auth] Platform server error:', fetchError);
        res.status(503).json({
          success: false,
          error: 'Unable to connect to platform server',
        });
      }
    } catch (error) {
      console.error('[Auth] Code login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });
}

export default registerAuthRoutes;
