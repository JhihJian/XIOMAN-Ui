/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MSW handlers for platform API mocking
 */

import { authHandlers } from './auth';
import { agentsHandlers } from './agents';
import { notificationsHandlers } from './notifications';

/**
 * All API handlers combined
 */
export const handlers = [...authHandlers, ...agentsHandlers, ...notificationsHandlers];

export { authHandlers } from './auth';
export { agentsHandlers } from './agents';
export { notificationsHandlers } from './notifications';
