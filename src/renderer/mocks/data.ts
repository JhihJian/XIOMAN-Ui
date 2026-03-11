/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mock data for platform integration
 * Used by MSW handlers for development and testing
 */

import type {
  PlatformAgent,
  PlatformNotification,
  RegisterResponse,
} from '@/common/types/platformTypes';

/**
 * Mock authorization code for development
 */
export const MOCK_AUTH_CODE = 'DEMO-2026';

/**
 * Mock platform agents
 */
export const mockAgents: PlatformAgent[] = [
  {
    agent_id: 'platform-docking',
    name: '全国平台对接助手',
    description:
      '负责与全国安全生产信息平台进行数据对接，自动同步企业信息、人员信息和安全生产数据。',
    version: '1.2.0',
    icon: 'platform-docking.png',
    download_url: 'https://example.com/agents/platform-docking-1.2.0.zip',
    remote_updated_at: '2026-03-01T10:00:00Z',
    local_installed_at: '2026-03-05T14:30:00Z',
    local_version: '1.2.0',
    status: 'ready',
  },
  {
    agent_id: 'hazard-reporting',
    name: '问题隐患整改信息上报助手',
    description:
      '用于上报问题隐患的整改情况，包括隐患描述、整改措施、整改进度和完成状态等信息。',
    version: '2.0.0',
    icon: 'hazard-reporting.png',
    download_url: 'https://example.com/agents/hazard-reporting-2.0.0.zip',
    remote_updated_at: '2026-03-08T09:00:00Z',
    local_installed_at: '2026-02-20T11:00:00Z',
    local_version: '1.8.0',
    status: 'update_available',
  },
  {
    agent_id: 'inspection-reporting',
    name: '落查任务结果信息上报助手',
    description:
      '用于上报落查任务的结果信息，包括任务完成情况、检查结果、发现的问题及处理建议等。',
    version: '1.0.0',
    icon: 'inspection-reporting.png',
    download_url: 'https://example.com/agents/inspection-reporting-1.0.0.zip',
    remote_updated_at: '2026-03-10T08:00:00Z',
    status: 'not_installed',
  },
];

/**
 * Mock platform notifications
 */
export const mockNotifications: PlatformNotification[] = [
  {
    id: 'notif-001',
    title: '平台对接数据更新通知',
    content:
      '全国平台对接助手有新的数据可接入。系统检测到以下数据更新：\n\n1. 企业基础信息变更：共 3 条\n2. 安全生产许可证更新：共 2 条\n3. 人员资质证书更新：共 5 条\n\n请及时查看并确认数据同步。',
    type: 'update',
    related_agent_id: 'platform-docking',
    created_at: '2026-03-11T09:30:00Z',
    read: false,
  },
  {
    id: 'notif-002',
    title: '问题隐患待反馈通知',
    content:
      '您有新的问题隐患信息待反馈：\n\n隐患编号：HZ-2026-0032\n隐患类型：设备安全\n隐患等级：一般\n发现时间：2026-03-10 14:20\n发现地点：生产车间A区\n\n隐患描述：发现叉车日常点检记录不完整，部分检查项目未按要求填写。\n\n请于 2026-03-15 前完成整改并上报。',
    type: 'task',
    related_agent_id: 'hazard-reporting',
    created_at: '2026-03-10T15:00:00Z',
    read: false,
  },
  {
    id: 'notif-003',
    title: '落查任务待反馈通知',
    content:
      '您有新的落查任务信息待反馈：\n\n任务编号：LC-2026-0018\n任务类型：专项检查\n任务来源：上级监管部门\n下发时间：2026-03-09 10:00\n\n任务要求：\n对重点危险源进行全面排查，核实安全管理措施落实情况。\n\n截止时间：2026-03-20\n请尽快完成检查并上报结果。',
    type: 'task',
    related_agent_id: 'inspection-reporting',
    created_at: '2026-03-09T10:30:00Z',
    read: true,
  },
];

/**
 * Mock register response
 */
export const mockRegisterResponse: RegisterResponse = {
  node_id: 'node-demo-2026-001',
  token: 'mock-jwt-token-xxxxx-yyyyy-zzzzz',
  token_expires_at: '2027-03-11T00:00:00Z',
};
