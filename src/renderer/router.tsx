/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLoader from './components/AppLoader';
import { useAuth } from './context/AuthContext';
import { usePlatformAuth } from './context/PlatformAuthContext';
import Conversation from './pages/conversation';
import Guid from './pages/guid';
import About from './pages/settings/About';
import AgentSettings from './pages/settings/AgentSettings';
import DisplaySettings from './pages/settings/DisplaySettings';
import ModeSettings from './pages/settings/ModeSettings';
import SystemSettings from './pages/settings/SystemSettings';
import ToolsSettings from './pages/settings/ToolsSettings';
import WebuiSettings from './pages/settings/WebuiSettings';
import LoginPage from './pages/login';
import AuthGuidePage from './pages/auth/AuthGuidePage';
import DisabledPage from './pages/status/DisabledPage';
import OfflinePage from './pages/status/OfflinePage';
import ComponentsShowcase from './pages/test/ComponentsShowcase';

/**
 * Platform Auth Guard - Checks platform authentication status
 * Handles unauthenticated, disabled, and offline states
 */
const PlatformAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = usePlatformAuth();

  if (status === 'checking') return <AppLoader />;
  if (status === 'unauthenticated') return <AuthGuidePage />;
  if (status === 'disabled') return <DisabledPage />;
  if (status === 'offline') return <OfflinePage />;

  return <>{children}</>;
};

const ProtectedLayout: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return <PlatformAuthGuard>{React.cloneElement(layout)}</PlatformAuthGuard>;
};

const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route path='/login' element={status === 'authenticated' ? <Navigate to='/guid' replace /> : <LoginPage />} />
        <Route element={<ProtectedLayout layout={layout} />}>
          <Route index element={<Navigate to='/guid' replace />} />
          <Route path='/guid' element={<Guid />} />
          <Route path='/conversation/:id' element={<Conversation />} />
          <Route path='/settings/model' element={<ModeSettings />} />
          <Route path='/settings/agent' element={<AgentSettings />} />
          <Route path='/settings/display' element={<DisplaySettings />} />
          <Route path='/settings/webui' element={<WebuiSettings />} />
          <Route path='/settings/system' element={<SystemSettings />} />
          <Route path='/settings/about' element={<About />} />
          <Route path='/settings/tools' element={<ToolsSettings />} />
          <Route path='/settings' element={<Navigate to='/settings/model' replace />} />
          <Route path='/test/components' element={<ComponentsShowcase />} />
        </Route>
        <Route path='*' element={<Navigate to={status === 'authenticated' ? '/guid' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;
