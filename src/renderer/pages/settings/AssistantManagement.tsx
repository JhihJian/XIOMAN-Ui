/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Empty, Spin, Tag } from '@arco-design/web-react';
import type { Message } from '@arco-design/web-react';
import { CheckOne, Download, Refresh, Robot } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ipcBridge } from '@/common';
import type { PlatformAgentConfig } from '@/common/types/platformTypes';
import styles from './AssistantManagement.module.css';

interface AssistantManagementProps {
  message: ReturnType<typeof Message.useMessage>[0];
}

const statusConfig = {
  installed: {
    color: 'green',
    labelKey: 'settings.agentStatusReady',
    defaultValue: 'Ready',
  },
  update_available: {
    color: 'orange',
    labelKey: 'settings.agentStatusUpdateAvailable',
    defaultValue: 'Update Available',
  },
  not_installed: {
    color: 'gray',
    labelKey: 'settings.agentStatusNotInstalled',
    defaultValue: 'Not Installed',
  },
} as const;

const AssistantManagement: React.FC<AssistantManagementProps> = ({ message }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<PlatformAgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  const fetchAgentList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.platform.getAgentList.invoke();
      if (result.success && result.data) {
        setAgents(result.data);
      } else {
        message.error(result.msg || t('common.fetchFailed', { defaultValue: 'Failed to fetch data' }));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('common.fetchFailed', { defaultValue: 'Failed to fetch data' }));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void fetchAgentList();
  }, [fetchAgentList]);

  // Installed or update available agents
  const installedAgents = agents.filter((a) => a.status === 'installed' || a.status === 'update_available');

  // Available to install agents
  const availableAgents = agents.filter((a) => a.status === 'not_installed');

  const handleEnterConversation = (agentId: string) => {
    void navigate('/guid', { state: { agentId } });
  };

  const handleDownload = async (agentId: string) => {
    setDownloadingId(agentId);
    try {
      const result = await ipcBridge.platform.downloadAgent.invoke({ agentId });
      if (result.success) {
        message.success(t('settings.agentDownloadSuccess', { defaultValue: 'Agent downloaded successfully' }));
        await fetchAgentList();
      } else {
        message.error(result.msg || t('settings.agentDownloadFailed', { defaultValue: 'Failed to download agent' }));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.agentDownloadFailed', { defaultValue: 'Failed to download agent' }));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUninstall = async (agentId: string) => {
    setUninstallingId(agentId);
    try {
      const result = await ipcBridge.platform.uninstallAgent.invoke({ agentId });
      if (result.success) {
        message.success(t('settings.agentUninstallSuccess', { defaultValue: 'Agent uninstalled successfully' }));
        await fetchAgentList();
      } else {
        message.error(result.msg || t('settings.agentUninstallFailed', { defaultValue: 'Failed to uninstall agent' }));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.agentUninstallFailed', { defaultValue: 'Failed to uninstall agent' }));
    } finally {
      setUninstallingId(null);
    }
  };

  const handleRefresh = () => {
    void fetchAgentList();
  };

  const renderAgentCard = (agent: PlatformAgentConfig) => {
    const statusInfo = statusConfig[agent.status];
    const isDownloading = downloadingId === agent.id;
    const isUninstalling = uninstallingId === agent.id;

    const renderActions = () => {
      switch (agent.status) {
        case 'not_installed':
          return (
            <Button type='primary' size='small' icon={<Download size='14' />} loading={isDownloading} onClick={() => void handleDownload(agent.id)} className={styles.downloadBtn}>
              {t('settings.agentDownloadInstall', { defaultValue: 'Download & Install' })}
            </Button>
          );
        case 'update_available':
          return (
            <div className={styles.actionsGroup}>
              <Button size='small' icon={<Refresh size='14' />} loading={isDownloading} onClick={() => void handleDownload(agent.id)}>
                {t('settings.agentUpdate', { defaultValue: 'Update' })}
              </Button>
              <Button type='primary' size='small' onClick={() => handleEnterConversation(agent.id)}>
                {t('settings.agentEnterConversation', { defaultValue: 'Enter Conversation' })}
              </Button>
            </div>
          );
        case 'installed':
          return (
            <div className={styles.actionsGroup}>
              <Button type='primary' size='small' icon={<CheckOne size='14' />} onClick={() => handleEnterConversation(agent.id)}>
                {t('settings.agentEnterConversation', { defaultValue: 'Enter Conversation' })}
              </Button>
              <Button size='small' status='danger' loading={isUninstalling} onClick={() => void handleUninstall(agent.id)}>
                {t('common.uninstall', { defaultValue: 'Uninstall' })}
              </Button>
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div key={agent.id} className={styles.card}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrapper}>{agent.avatar ? <img src={agent.avatar} alt={agent.name} className={styles.iconImage} /> : <Robot size='24' fill='rgb(var(--primary-6))' />}</div>
            <div className={styles.titleSection}>
              <div className={styles.name}>{agent.name}</div>
              <div className={styles.version}>v{agent.platformVersion}</div>
            </div>
          </div>
          <Tag color={statusInfo.color} className={styles.statusTag}>
            {t(statusInfo.labelKey, { defaultValue: statusInfo.defaultValue })}
          </Tag>
        </div>

        <div className={styles.description}>{agent.description}</div>

        <div className={styles.footer}>{renderActions()}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-48px'>
        <Spin size={32} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className='flex items-center justify-between mb-16px'>
        <h2 className='text-lg font-semibold m-0'>{t('settings.platformAgents', { defaultValue: 'Platform Agents' })}</h2>
        <Button size='small' icon={<Refresh size='14' />} onClick={handleRefresh} loading={loading}>
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {/* Installed Agents Section */}
      {installedAgents.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('settings.installedAgents', { defaultValue: 'Installed Agents' })}</h3>
          <div className={styles.grid}>{installedAgents.map(renderAgentCard)}</div>
        </section>
      )}

      {/* Available Agents Section */}
      {availableAgents.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('settings.availableAgents', { defaultValue: 'Available Agents' })}</h3>
          <div className={styles.grid}>{availableAgents.map(renderAgentCard)}</div>
        </section>
      )}

      {/* Empty State */}
      {agents.length === 0 && <Empty description={t('settings.noAgentsAvailable', { defaultValue: 'No agents available' })} />}
    </div>
  );
};

export default AssistantManagement;
