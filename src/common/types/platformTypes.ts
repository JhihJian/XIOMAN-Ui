/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 平台相关类型定义
 * Platform-related type definitions
 */

import type { AcpBackendConfig } from '@/types/acpTypes';

// 节点认证凭证 / Node authentication credential
export interface NodeCredential {
  token: string;
  token_expires_at: string; // ISO format
}

// 注册请求参数 / Registration request payload
export interface RegisterRequest {
  auth_code: string;
}

// 注册响应 / Registration response
export interface RegisterResponse {
  node_id: string;
  token: string;
  token_expires_at: string;
}

// 权限校验响应 / Authorization check response
export interface AuthCheckResponse {
  status: 'active' | 'disabled' | 'expired';
  message?: string;
}

/** 平台助手配置（直接复用 AcpBackendConfig）/ Platform Agent configuration (reuses AcpBackendConfig) */
export type PlatformAgentConfig = AcpBackendConfig & {
  /** 安装状态 / Installation status */
  status: 'installed' | 'update_available' | 'not_installed';

  /** 下载地址 / Download URL */
  downloadUrl: string;
};

/** 平台助手列表响应 / Platform agent list response */
export type PlatformAgentListResponse = PlatformAgentConfig[];

/**
 * @deprecated Use `PlatformAgentConfig` instead. This type is kept for backward compatibility.
 */
export type PlatformAgent = PlatformAgentConfig;

// 通知 / Platform notification
export interface PlatformNotification {
  id: string;
  title: string;
  content: string;
  type: 'update' | 'task' | 'alert' | 'info';
  related_agent_id: string | null;
  created_at: string;
  read: boolean;
}

// Agent YAML 配置 / Agent YAML configuration
export interface AgentYamlConfig {
  agent_id: string;
  name: string;
  description: string;
  rules: string;
  knowledge_files: string[];
  tools: ToolDefinition[];
}

// 工具定义 / Tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// 认证状态 / Authentication status
export type PlatformAuthStatus =
  | 'checking' // 正在校验 / Checking authentication
  | 'authenticated' // 已认证 / Authenticated
  | 'unauthenticated' // 未认证（需要输入授权码）/ Unauthenticated (auth code required)
  | 'disabled' // 节点被禁用 / Node disabled
  | 'offline'; // 离线 / Offline
