/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import PlatformAgentList from './PlatformAgentList';

const AgentSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <PlatformAgentList />
    </SettingsPageWrapper>
  );
};

export default AgentSettings;
