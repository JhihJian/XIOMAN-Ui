/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ipcBridge } from '@/common';
import type { PlatformAuthStatus } from '@/common/types/platformTypes';

interface PlatformAuthContextValue {
  status: PlatformAuthStatus;
  isLoading: boolean;
  error: string | null;
  register: (authCode: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | undefined>(undefined);

export const PlatformAuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<PlatformAuthStatus>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('checking');
    setError(null);

    try {
      // Check if credentials exist locally
      const credResult = await ipcBridge.platform.getCredentials.invoke();
      if (!credResult.success || !credResult.data) {
        setStatus('unauthenticated');
        return;
      }

      // Validate credentials with server
      const checkResult = await ipcBridge.platform.authCheck.invoke();
      if (checkResult.success && checkResult.data) {
        const { status: authStatus } = checkResult.data;

        if (authStatus === 'active') {
          setStatus('authenticated');
        } else if (authStatus === 'disabled') {
          setStatus('disabled');
        } else {
          setStatus('unauthenticated');
        }
      } else {
        // Network error, offline mode
        if (checkResult.msg?.includes('fetch') || checkResult.msg?.includes('Network')) {
          setStatus('offline');
        } else {
          setStatus('unauthenticated');
        }
      }
    } catch (err) {
      console.error('[PlatformAuth] Refresh error:', err);
      setStatus('offline');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const register = useCallback(async (authCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await ipcBridge.platform.register.invoke({ auth_code: authCode });

      if (result.success) {
        setStatus('authenticated');
        return { success: true };
      } else {
        const message = result.msg || 'Registration failed';
        setError(message);
        return { success: false, message };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await ipcBridge.platform.clearCredentials.invoke();
    setStatus('unauthenticated');
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      status,
      isLoading,
      error,
      register,
      logout,
      refresh,
    }),
    [status, isLoading, error, register, logout, refresh]
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
};

export function usePlatformAuth(): PlatformAuthContextValue {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  }
  return context;
}
