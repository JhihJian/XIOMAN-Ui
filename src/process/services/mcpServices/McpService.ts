/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import type { AcpBackend } from '../../../types/acpTypes';
import type { IMcpServer } from '../../../common/storage';
import { ClaudeMcpAgent } from './agents/ClaudeMcpAgent';
import { CodebuddyMcpAgent } from './agents/CodebuddyMcpAgent';
import { QwenMcpAgent } from './agents/QwenMcpAgent';
import { IflowMcpAgent } from './agents/IflowMcpAgent';
import { AionuiMcpAgent } from './agents/AionuiMcpAgent';
import { CodexMcpAgent } from './agents/CodexMcpAgent';
import type { IMcpProtocol, DetectedMcpServer, McpConnectionTestResult, McpSyncResult, McpSource } from './McpProtocol';

/**
 * MCP服务 - 负责协调各个Agent的MCP操作协议
 * 新架构：只定义协议，具体实现由各个Agent类完成
 *
 * Agent 类型说明：
 * - AcpBackend ('claude', 'qwen', 'iflow', 'codex'等): 支持的 ACP 后端
 * - 'aionui': @office-ai/aioncli-core (AionUi 本地管理)
 */
export class McpService {
  private agents: Map<McpSource, IMcpProtocol>;

  /**
   * Service-level operation lock to serialize heavy MCP operations.
   * Prevents concurrent getAgentMcpConfigs / syncMcpToAgents / removeMcpFromAgents
   * which would otherwise spawn dozens of child processes simultaneously,
   * causing resource exhaustion and potential system freezes.
   */
  private operationQueue: Promise<unknown> = Promise.resolve();

  private withServiceLock<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.operationQueue.then(operation, () => operation());
    // Keep the queue moving even if the operation rejects
    this.operationQueue = queued.catch(() => {});
    return queued;
  }

  private isCliAvailable(cliCommand: string): boolean {
    const isWindows = process.platform === 'win32';
    const whichCommand = isWindows ? 'where' : 'which';

    // Keep original behavior: prefer where/which, then fallback on Windows to Get-Command.
    // 保持原逻辑：优先使用 where/which，Windows 下失败再回退到 Get-Command。
    try {
      execSync(`${whichCommand} ${cliCommand}`, { encoding: 'utf-8', stdio: 'pipe', timeout: 1000 });
      return true;
    } catch {
      if (!isWindows) return false;
    }

    if (isWindows) {
      try {
        // PowerShell fallback for shim scripts like *.ps1 (vfox)
        // PowerShell 回退，支持 *.ps1 shim（例如 vfox）
        execSync(`powershell -NoProfile -NonInteractive -Command "Get-Command -All ${cliCommand} | Select-Object -First 1 | Out-Null"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 1000,
        });
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  constructor() {
    this.agents = new Map([
      ['claude', new ClaudeMcpAgent()],
      ['codebuddy', new CodebuddyMcpAgent()],
      ['qwen', new QwenMcpAgent()],
      ['iflow', new IflowMcpAgent()],
      ['aionui', new AionuiMcpAgent()], // AionUi 本地 @office-ai/aioncli-core
      ['codex', new CodexMcpAgent()],
    ]);
  }

  /**
   * 获取特定backend的agent实例
   */
  private getAgent(backend: McpSource): IMcpProtocol | undefined {
    return this.agents.get(backend);
  }

  /**
   * 根据 agent 配置获取正确的 MCP agent 实例
   *
   * Get the correct MCP agent instance based on agent config.
   */
  private getAgentForConfig(agent: { backend: AcpBackend; cliPath?: string }): IMcpProtocol | undefined {
    return this.agents.get(agent.backend);
  }

  /**
   * 从检测到的ACP agents中获取MCP配置（并发版本）
   */
  getAgentMcpConfigs(
    agents: Array<{
      backend: AcpBackend;
      name: string;
      cliPath?: string;
    }>
  ): Promise<DetectedMcpServer[]> {
    return this.withServiceLock(async () => {
      // 并发执行所有agent的MCP检测
      const promises = agents.map(async (agent) => {
        try {
          const agentInstance = this.getAgent(agent.backend);
          if (!agentInstance) {
            console.warn(`[McpService] No agent instance for backend: ${agent.backend}`);
            return null;
          }

          const servers = await agentInstance.detectMcpServers(agent.cliPath);
          console.log(`[McpService] Detected ${servers.length} MCP servers for ${agent.backend} (cliPath: ${agent.cliPath || 'default'})`);

          if (servers.length > 0) {
            return {
              source: agent.backend as McpSource,
              servers,
            };
          }
          return null;
        } catch (error) {
          console.warn(`[McpService] Failed to detect MCP servers for ${agent.backend}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      return results.filter((result): result is DetectedMcpServer => result !== null);
    });
  }

  /**
   * Get supported transport types for a given agent config.
   */
  getSupportedTransportsForAgent(agent: { backend: string; cliPath?: string }): string[] {
    const agentInstance = this.getAgentForConfig(agent as { backend: AcpBackend; cliPath?: string });
    return agentInstance ? agentInstance.getSupportedTransports() : [];
  }

  /**
   * 测试MCP服务器连接
   */
  async testMcpConnection(server: IMcpServer): Promise<McpConnectionTestResult> {
    // 使用第一个可用的agent进行连接测试，因为测试逻辑在基类中是通用的
    const firstAgent = this.agents.values().next().value;
    if (firstAgent) {
      return await firstAgent.testMcpConnection(server);
    }
    return { success: false, error: 'No agent available for connection testing' };
  }

  /**
   * 将MCP配置同步到所有检测到的agent
   */
  syncMcpToAgents(
    mcpServers: IMcpServer[],
    agents: Array<{
      backend: AcpBackend;
      name: string;
      cliPath?: string;
    }>
  ): Promise<McpSyncResult> {
    // 只同步启用的MCP服务器
    const enabledServers = mcpServers.filter((server) => server.enabled);

    if (enabledServers.length === 0) {
      return Promise.resolve({ success: true, results: [] });
    }

    return this.withServiceLock(async () => {
      // 并发执行所有agent的MCP同步
      const promises = agents.map(async (agent) => {
        try {
          const agentInstance = this.getAgentForConfig(agent);
          if (!agentInstance) {
            console.warn(`[McpService] Skipping MCP sync for unsupported backend: ${agent.backend}`);
            return {
              agent: agent.name,
              success: true,
            };
          }

          const result = await agentInstance.installMcpServers(enabledServers);
          return {
            agent: agent.name,
            success: result.success,
            error: result.error,
          };
        } catch (error) {
          return {
            agent: agent.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const results = await Promise.all(promises);

      const allSuccess = results.every((r) => r.success);

      return { success: allSuccess, results };
    });
  }

  /**
   * 从所有检测到的agent中删除MCP配置
   */
  removeMcpFromAgents(
    mcpServerName: string,
    agents: Array<{
      backend: AcpBackend;
      name: string;
      cliPath?: string;
    }>
  ): Promise<McpSyncResult> {
    return this.withServiceLock(async () => {
      // 并发执行所有agent的MCP删除
      const promises = agents.map(async (agent) => {
        try {
          const agentInstance = this.getAgentForConfig(agent);
          if (!agentInstance) {
            console.warn(`[McpService] Skipping MCP removal for unsupported backend: ${agent.backend}`);
            return {
              agent: `${agent.backend}:${agent.name}`,
              success: true,
            };
          }

          const result = await agentInstance.removeMcpServer(mcpServerName);
          return {
            agent: `${agent.backend}:${agent.name}`,
            success: result.success,
            error: result.error,
          };
        } catch (error) {
          return {
            agent: `${agent.backend}:${agent.name}`,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const results = await Promise.all(promises);

      return { success: true, results };
    });
  }
}

export const mcpService = new McpService();
