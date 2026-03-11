/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MSW browser setup for mocking API requests in the renderer process
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/**
 * Start MSW worker for API mocking
 */
export async function startMockService(): Promise<void> {
  // Only start in dev mode or when mock is explicitly enabled
  const shouldMock = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK === 'true';

  if (!shouldMock) {
    console.log('[MSW] Mock service disabled');
    return;
  }

  try {
    await worker.start({
      onUnhandledRequest: 'bypass', // Pass through unhandled requests
    });
    console.log('[MSW] Mock service started');
  } catch (error) {
    console.error('[MSW] Failed to start mock service:', error);
  }
}
