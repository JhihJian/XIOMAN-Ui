/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Channel Model Selector - Simple model selection for channel settings
 *
 * Replaces the previous Gemini-specific model selector with a generic one
 * that works with any configured provider.
 */

import type { IProvider, TProviderWithModel } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import { useModelProviderList } from '@/renderer/hooks/useModelProviderList';
import { Button, Dropdown, Menu, Tooltip } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Model selection state and actions for channel settings
 */
export interface ChannelModelSelection {
  /** Currently selected provider with model */
  currentModel: TProviderWithModel | null;
  /** Whether models are loading */
  isLoading: boolean;
  /** Available providers */
  providers: IProvider[];
  /** Callback when model is selected */
  onSelectModel?: (provider: IProvider, modelName: string) => Promise<boolean>;
}

/**
 * Props for ChannelModelSelector component
 */
interface ChannelModelSelectorProps {
  /** Model selection state */
  selection: ChannelModelSelection | undefined;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Label to show when disabled */
  label?: string;
  /** Display variant */
  variant?: 'header' | 'settings';
}

/**
 * Channel Model Selector Component
 *
 * Displays a dropdown to select a model from configured providers.
 * Used in channel settings (Telegram, Lark, DingTalk) to set default models.
 */
const ChannelModelSelector: React.FC<ChannelModelSelectorProps> = ({ selection, disabled = false, label, variant = 'header' }) => {
  const { t } = useTranslation();
  const { providers, formatModelLabel } = useModelProviderList();

  // Build model options from providers
  const modelOptions = useMemo(() => {
    const options: Array<{ provider: IProvider; modelName: string; label: string }> = [];
    providers.forEach((provider) => {
      provider.model?.forEach((modelName) => {
        options.push({
          provider,
          modelName,
          label: `${provider.name} / ${modelName}`,
        });
      });
    });
    return options;
  }, [providers]);

  // Handle model selection
  const handleSelect = useCallback(
    (key: string) => {
      const option = modelOptions.find((opt) => `${option.provider.id}:${option.modelName}` === key);
      if (option && selection?.onSelectModel) {
        void selection.onSelectModel(option.provider, option.modelName);
      }
    },
    [modelOptions, selection]
  );

  // Disabled state - show label or default text
  if (disabled || !selection) {
    return (
      <Tooltip content={label || t('settings.assistant.autoFollowCliModel', 'Auto-follow CLI model')}>
        <Button size='mini' disabled>
          {label || t('settings.assistant.autoFollowCliModel', 'Auto-follow CLI model')}
        </Button>
      </Tooltip>
    );
  }

  // No models configured
  if (modelOptions.length === 0) {
    return (
      <Tooltip content={t('settings.assistant.noModelsConfigured', 'No models configured')}>
        <Button size='mini' disabled>
          {t('settings.assistant.noModelsConfigured', 'No models')}
        </Button>
      </Tooltip>
    );
  }

  const currentLabel = selection.currentModel ? `${selection.currentModel.name} / ${selection.currentModel.useModel}` : t('settings.assistant.selectModel', 'Select model');

  return (
    <Dropdown
      droplist={
        <Menu onClickMenuItem={handleSelect}>
          {modelOptions.map((option) => (
            <Menu.Item key={`${option.provider.id}:${option.modelName}`}>{option.label}</Menu.Item>
          ))}
        </Menu>
      }
      trigger={['click']}
    >
      <Button size={variant === 'settings' ? 'small' : 'mini'}>{currentLabel}</Button>
    </Dropdown>
  );
};

export default ChannelModelSelector;

/**
 * Hook for channel model selection with persistence
 *
 * @param configKey - Config storage key for persisting model selection
 * @returns ChannelModelSelection state
 */
export const useChannelModelSelection = (configKey: string): ChannelModelSelection => {
  const { providers, isLoading } = useModelProviderList();
  const [currentModel, setCurrentModel] = useState<TProviderWithModel | null>(null);

  // Resolve initial model from config on mount and when providers change
  useEffect(() => {
    if (providers.length === 0 || currentModel) return;

    const loadInitialModel = async () => {
      try {
        const saved = (await ConfigStorage.get(configKey)) as { id: string; useModel: string } | undefined;
        if (saved?.id && saved?.useModel) {
          const provider = providers.find((p) => p.id === saved.id);
          if (provider && provider.model?.includes(saved.useModel)) {
            setCurrentModel({
              ...provider,
              useModel: saved.useModel,
            } as TProviderWithModel);
          }
        }
      } catch (error) {
        console.error(`[useChannelModelSelection] Failed to load initial model:`, error);
      }
    };

    void loadInitialModel();
  }, [providers, configKey, currentModel]);

  return useMemo(
    () => ({
      currentModel,
      isLoading,
      providers,
    }),
    [currentModel, isLoading, providers]
  );
};
