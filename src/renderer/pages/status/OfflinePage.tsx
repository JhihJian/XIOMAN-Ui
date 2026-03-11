/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { Button } from '@arco-design/web-react';
import { IconExclamationCircleFill, IconLoading } from '@arco-design/web-react/icon';
import { usePlatformAuth } from '@renderer/context/PlatformAuthContext';
import './StatusPage.css';

const OfflinePage: React.FC = () => {
  const { refresh } = usePlatformAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleRetry = useCallback(async () => {
    setIsLoading(true);
    try {
      await refresh();
    } finally {
      // Small delay to show loading state
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  }, [refresh]);

  return (
    <div className='status-page'>
      <div className='status-page__content'>
        <div className='status-page__icon status-page__icon--warning'>
          <IconExclamationCircleFill />
        </div>
        <h1 className='status-page__title'>无法连接中心平台</h1>
        <p className='status-page__description'>网络连接异常，无法连接到中心平台。请检查网络连接后重试。</p>
        <Button type='primary' size='large' className='status-page__action' onClick={handleRetry} disabled={isLoading} icon={isLoading ? <IconLoading /> : undefined}>
          {isLoading ? '连接中...' : '重试连接'}
        </Button>
      </div>
    </div>
  );
};

export default OfflinePage;
