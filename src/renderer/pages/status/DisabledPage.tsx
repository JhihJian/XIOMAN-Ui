/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react';
import { Button } from '@arco-design/web-react';
import { IconCloseCircleFill } from '@arco-design/web-react/icon';
import { usePlatformAuth } from '@renderer/context/PlatformAuthContext';
import './StatusPage.css';

const DisabledPage: React.FC = () => {
  const { logout } = usePlatformAuth();

  const handleReauth = useCallback(() => {
    void logout();
  }, [logout]);

  return (
    <div className='status-page'>
      <div className='status-page__content'>
        <div className='status-page__icon status-page__icon--error'>
          <IconCloseCircleFill />
        </div>
        <h1 className='status-page__title'>节点已被禁用</h1>
        <p className='status-page__description'>该节点已被管理员禁用，无法继续使用。请联系管理员了解更多信息。</p>
        <Button type='primary' size='large' className='status-page__action' onClick={handleReauth}>
          重新认证
        </Button>
      </div>
    </div>
  );
};

export default DisabledPage;
