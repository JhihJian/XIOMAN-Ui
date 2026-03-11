/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// src/common/config/platformConfig.ts

/**
 * 平台预置配置
 * Platform preset configuration
 */

export const PLATFORM_CONFIG = {
  // 中心平台地址，可通过环境变量覆盖
  // 在 dev 模式下使用空字符串以启用 MSW mock
  serverUrl: process.env.PLATFORM_URL || (process.env.NODE_ENV === 'development' ? '' : 'https://platform.example.com'),

  // 通知轮询间隔（毫秒）
  notificationPollInterval: 5 * 60 * 1000, // 5 分钟

  // Agent 存储目录名
  agentDirName: 'agents',
} as const;

/**
 * 获取 Agent 存储路径
 */
export function getAgentStoragePath(basePath: string): string {
  return `${basePath}/${PLATFORM_CONFIG.agentDirName}`;
}
