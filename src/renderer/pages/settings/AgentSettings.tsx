/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message } from '@arco-design/web-react';
import React from 'react';
import AssistantManagement from './AssistantManagement';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const AgentSettings: React.FC = () => {
  const [agentMessage, agentMessageContext] = Message.useMessage({ maxCount: 10 });

  return (
    <SettingsPageWrapper>
      {agentMessageContext}
      <AssistantManagement message={agentMessage} />
    </SettingsPageWrapper>
  );
};

export default AgentSettings;
