/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Tag } from '@arco-design/web-react';
import { Robot, Download, Update, CheckCircle } from '@icon-park/react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlatformAgent } from '@/common/types/platformTypes';
import styles from './index.module.css';

type PlatformAgentCardProps = {
  agent: PlatformAgent;
  onDownload?: (agentId: string) => void;
  downloading?: boolean;
};

const statusConfig = {
  ready: {
    color: 'green',
    label: 'Ready',
  },
  update_available: {
    color: 'orange',
    label: 'Update Available',
  },
  not_installed: {
    color: 'gray',
    label: 'Not Installed',
  },
} as const;

const PlatformAgentCard: React.FC<PlatformAgentCardProps> = ({ agent, onDownload, downloading = false }) => {
  const navigate = useNavigate();

  const handleNavigateToConversation = () => {
    void navigate('/guid', { state: { agentId: agent.agent_id } });
  };

  const handleDownload = () => {
    onDownload?.(agent.agent_id);
  };

  const statusInfo = statusConfig[agent.status];

  const renderActions = () => {
    switch (agent.status) {
      case 'not_installed':
        return (
          <Button type='primary' size='small' icon={<Download size='14' />} loading={downloading} onClick={handleDownload} className={styles.downloadBtn}>
            Download & Install
          </Button>
        );
      case 'update_available':
        return (
          <div className={styles.actionsGroup}>
            <Button size='small' icon={<Update size='14' />} loading={downloading} onClick={handleDownload}>
              Update
            </Button>
            <Button type='primary' size='small' onClick={handleNavigateToConversation}>
              Enter Conversation
            </Button>
          </div>
        );
      case 'ready':
        return (
          <Button type='primary' size='small' icon={<CheckCircle size='14' />} onClick={handleNavigateToConversation}>
            Enter Conversation
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconWrapper}>{agent.icon ? <img src={agent.icon} alt={agent.name} className={styles.iconImage} /> : <Robot size='24' fill='rgb(var(--primary-6))' />}</div>
          <div className={styles.titleSection}>
            <div className={styles.name}>{agent.name}</div>
            <div className={styles.version}>v{agent.version}</div>
          </div>
        </div>
        <Tag color={statusInfo.color} className={styles.statusTag}>
          {statusInfo.label}
        </Tag>
      </div>

      <div className={styles.description}>{agent.description}</div>

      <div className={styles.footer}>{renderActions()}</div>
    </div>
  );
};

export default PlatformAgentCard;
