/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Spin, Empty, Message } from '@arco-design/web-react';
import { Refresh } from '@icon-park/react';
import React, { useState, useCallback, useEffect } from 'react';
import { ipcBridge } from '@/common';
import type { PlatformAgent } from '@/common/types/platformTypes';
import PlatformAgentCard from '@/renderer/components/PlatformAgentCard';

const PlatformAgentList: React.FC = () => {
  const [agents, setAgents] = useState<PlatformAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchAgentList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.platform.getAgentList.invoke();
      if (result.success && result.data) {
        setAgents(result.data);
      } else {
        Message.error(result.msg || 'Failed to fetch agent list');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to fetch agent list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgentList();
  }, [fetchAgentList]);

  const handleDownload = async (agentId: string) => {
    setDownloadingId(agentId);
    try {
      const result = await ipcBridge.platform.downloadAgent.invoke({ agentId });
      if (result.success) {
        Message.success('Agent downloaded successfully');
        await fetchAgentList();
      } else {
        Message.error(result.msg || 'Failed to download agent');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to download agent');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRefresh = () => {
    void fetchAgentList();
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-48px'>
        <Spin size={32} />
      </div>
    );
  }

  return (
    <div className='platform-agent-list'>
      <div className='flex items-center justify-between mb-16px'>
        <h2 className='text-lg font-semibold m-0'>Platform Agents</h2>
        <Button size='small' icon={<Refresh size='14' />} onClick={handleRefresh} loading={loading}>
          Refresh
        </Button>
      </div>

      {agents.length === 0 ? (
        <Empty description='No agents available' />
      ) : (
        <div className='grid gap-16px grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
          {agents.map((agent) => (
            <PlatformAgentCard key={agent.agent_id} agent={agent} onDownload={handleDownload} downloading={downloadingId === agent.agent_id} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PlatformAgentList;
