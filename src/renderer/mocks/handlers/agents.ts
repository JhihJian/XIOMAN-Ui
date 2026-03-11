/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agents API handlers for platform integration
 */

import { http, HttpResponse, delay } from 'msw';
import { mockAgents } from '../data';

/**
 * Agents API handlers
 */
export const agentsHandlers = [
  /**
   * GET /api/nodes/agents
   * Get list of available platform agents
   */
  http.get('/api/nodes/agents', async () => {
    await delay(600);

    return HttpResponse.json({
      success: true,
      data: {
        agents: mockAgents,
        total: mockAgents.length,
      },
    });
  }),

  /**
   * GET /api/agents/:agentId/package
   * Get agent package (mock download URL)
   */
  http.get('/api/agents/:agentId/package', async ({ params }) => {
    await delay(800);

    const { agentId } = params;
    const agent = mockAgents.find((a) => a.agent_id === agentId);

    if (!agent) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Agent not found',
        },
        { status: 404 }
      );
    }

    // Return mock package info
    return HttpResponse.json({
      success: true,
      data: {
        agent_id: agent.agent_id,
        name: agent.name,
        version: agent.version,
        download_url: agent.download_url,
        checksum: `sha256:${agentId}-mock-checksum`,
        size: 1024 * 1024 * 2.5, // 2.5 MB mock size
      },
    });
  }),
];
