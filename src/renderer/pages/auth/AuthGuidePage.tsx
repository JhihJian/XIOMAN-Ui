/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { Input, Button, Message } from '@arco-design/web-react';
import { IconKey } from '@arco-design/web-react/icon';
import { usePlatformAuth } from '@renderer/context/PlatformAuthContext';
import authLogo from '@renderer/assets/logos/app.png';
import './AuthGuidePage.css';

const AuthGuidePage: React.FC = () => {
  const { register, isLoading, error } = usePlatformAuth();
  const [authCode, setAuthCode] = useState('');

  const handleSubmit = useCallback(async () => {
    const trimmedCode = authCode.trim();
    if (!trimmedCode) {
      return;
    }
    await register(trimmedCode);
  }, [authCode, register]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !isLoading && authCode.trim()) {
        void handleSubmit();
      }
    },
    [handleSubmit, isLoading, authCode]
  );

  return (
    <div className="auth-guide-page">
      <div className="auth-guide-card">
        <div className="auth-guide-header">
          <div className="auth-guide-logo">
            <img src={authLogo} alt="App Logo" />
          </div>
          <h1 className="auth-guide-title">全国一体化智能中心</h1>
          <p className="auth-guide-subtitle">请输入授权码以激活应用</p>
        </div>

        <div className="auth-guide-form">
          <div className="auth-guide-input-wrapper">
            <Input
              prefix={<IconKey />}
              placeholder="请输入授权码"
              value={authCode}
              onChange={setAuthCode}
              onKeyDown={handleKeyDown}
              size="large"
              disabled={isLoading}
              className="auth-guide-input"
            />
          </div>

          <Button
            type="primary"
            size="large"
            long
            loading={isLoading}
            disabled={!authCode.trim()}
            onClick={handleSubmit}
            className="auth-guide-submit"
          >
            确认
          </Button>

          {error && (
            <Message type="error" className="auth-guide-error">
              {error}
            </Message>
          )}
        </div>

        <div className="auth-guide-footer">
          <p className="auth-guide-hint">提示：测试授权码为 DEMO-2026</p>
        </div>
      </div>
    </div>
  );
};

export default AuthGuidePage;
