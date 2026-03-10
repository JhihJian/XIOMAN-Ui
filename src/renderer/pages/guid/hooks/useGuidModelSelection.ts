/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IProvider, TProviderWithModel } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import { hasAvailableModels } from '../utils/modelUtils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

/**
 * Build a unique key for a provider/model pair.
 */
const buildModelKey = (providerId?: string, modelName?: string) => {
  if (!providerId || !modelName) return null;
  return `${providerId}:${modelName}`;
};

/**
 * Check if a model key still exists in the provider list.
 */
const isModelKeyAvailable = (key: string | null, providers?: IProvider[]) => {
  if (!key || !providers || providers.length === 0) return false;
  return providers.some((provider) => {
    if (!provider.id || !provider.model?.length) return false;
    return provider.model.some((modelName) => buildModelKey(provider.id, modelName) === key);
  });
};

export type GuidModelSelectionResult = {
  modelList: IProvider[];
  currentModel: TProviderWithModel | undefined;
  setCurrentModel: (modelInfo: TProviderWithModel) => Promise<void>;
  formatModelLabel: (provider: { platform?: string } | undefined, modelName?: string) => string;
  // Legacy properties for backward compatibility - Gemini-related
  isGoogleAuth: boolean;
  geminiModeOptions: Array<{ value: string; label: string }>;
  geminiModeLookup: Map<string, { value: string; label: string }>;
  formatGeminiModelLabel: (provider: { platform?: string } | undefined, modelName?: string) => string;
};

/**
 * Hook that manages model list and selection state for the Guid page.
 * Simplified version without Gemini-specific logic.
 */
export const useGuidModelSelection = (): GuidModelSelectionResult => {
  const { data: modelConfig } = useSWR('model.config.welcome', () => {
    return ipcBridge.mode.getModelConfig.invoke().then((data) => {
      return (data || []).filter((platform) => !!platform.model.length);
    });
  });

  const modelList = useMemo(() => {
    return (modelConfig || []).filter(hasAvailableModels);
  }, [modelConfig]);

  const formatModelLabel = useCallback((_provider: { platform?: string } | undefined, modelName?: string) => {
    return modelName || '';
  }, []);

  const [currentModel, _setCurrentModel] = useState<TProviderWithModel>();
  const selectedModelKeyRef = useRef<string | null>(null);

  const setCurrentModel = useCallback(async (modelInfo: TProviderWithModel) => {
    selectedModelKeyRef.current = buildModelKey(modelInfo.id, modelInfo.useModel);
    await ConfigStorage.set('defaultModel', { id: modelInfo.id, useModel: modelInfo.useModel }).catch((error) => {
      console.error('Failed to save default model:', error);
    });
    _setCurrentModel(modelInfo);
  }, []);

  // Set default model when modelList changes
  useEffect(() => {
    const setDefaultModel = async () => {
      if (!modelList || modelList.length === 0) {
        return;
      }
      const currentKey = selectedModelKeyRef.current || buildModelKey(currentModel?.id, currentModel?.useModel);
      if (isModelKeyAvailable(currentKey, modelList)) {
        if (!selectedModelKeyRef.current && currentKey) {
          selectedModelKeyRef.current = currentKey;
        }
        return;
      }
      const savedModel = await ConfigStorage.get('defaultModel');

      const isNewFormat = savedModel && typeof savedModel === 'object' && 'id' in savedModel;

      let defaultModel: IProvider | undefined;
      let resolvedUseModel: string;

      if (isNewFormat) {
        const { id, useModel } = savedModel;
        const exactMatch = modelList.find((m) => m.id === id);
        if (exactMatch && exactMatch.model.includes(useModel)) {
          defaultModel = exactMatch;
          resolvedUseModel = useModel;
        } else {
          defaultModel = modelList[0];
          resolvedUseModel = defaultModel?.model[0] ?? '';
        }
      } else if (typeof savedModel === 'string') {
        defaultModel = modelList.find((m) => m.model.includes(savedModel)) || modelList[0];
        resolvedUseModel = defaultModel?.model.includes(savedModel) ? savedModel : (defaultModel?.model[0] ?? '');
      } else {
        defaultModel = modelList[0];
        resolvedUseModel = defaultModel?.model[0] ?? '';
      }

      if (!defaultModel || !resolvedUseModel) return;

      await setCurrentModel({
        ...defaultModel,
        useModel: resolvedUseModel,
      });
    };

    setDefaultModel().catch((error) => {
      console.error('Failed to set default model:', error);
    });
  }, [modelList]);

  return {
    modelList,
    currentModel,
    setCurrentModel,
    formatModelLabel,
    // Legacy properties for backward compatibility - Gemini-related, all values are empty/false
    isGoogleAuth: false,
    geminiModeOptions: [],
    geminiModeLookup: new Map(),
    formatGeminiModelLabel: formatModelLabel,
  };
};
