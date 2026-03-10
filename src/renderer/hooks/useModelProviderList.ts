import { ipcBridge } from '@/common';
import type { IProvider } from '@/common/storage';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { hasSpecificModelCapability } from '@/renderer/utils/modelCapabilities';

export interface ModelProviderListResult {
  providers: IProvider[];
  getAvailableModels: (provider: IProvider) => string[];
  formatModelLabel: (provider: { platform?: string } | undefined, modelName?: string) => string;
}

/**
 * Shared hook that builds the provider list and exposes helpers
 * consumed by both conversation and channel settings.
 *
 * Simplified version without Gemini/Google Auth specific logic.
 */
export const useModelProviderList = (): ModelProviderListResult => {
  const { data: modelConfig } = useSWR('model.config.shared', () => ipcBridge.mode.getModelConfig.invoke());

  // Mutable cache for available-model filtering
  const availableModelsCacheRef = useRef(new Map<string, string[]>());

  // Clear cache when modelConfig changes
  useEffect(() => {
    availableModelsCacheRef.current.clear();
  }, [modelConfig]);

  const getAvailableModels = useCallback((provider: IProvider): string[] => {
    // Include modelEnabled status in cache key
    const modelEnabledKey = provider.modelEnabled ? JSON.stringify(provider.modelEnabled) : 'all-enabled';
    const cacheKey = `${provider.id}-${(provider.model || []).join(',')}-${modelEnabledKey}`;
    const cache = availableModelsCacheRef.current;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
    const result: string[] = [];
    for (const modelName of provider.model || []) {
      // Check if model is disabled (default is enabled)
      const isModelEnabled = provider.modelEnabled?.[modelName] !== false;
      if (!isModelEnabled) continue;

      const functionCalling = hasSpecificModelCapability(provider, modelName, 'function_calling');
      const excluded = hasSpecificModelCapability(provider, modelName, 'excludeFromPrimary');
      if ((functionCalling === true || functionCalling === undefined) && excluded !== true) {
        result.push(modelName);
      }
    }
    cache.set(cacheKey, result);
    return result;
  }, []);

  const providers = useMemo(() => {
    let list: IProvider[] = Array.isArray(modelConfig) ? modelConfig : [];
    // Filter out disabled providers (default is enabled)
    list = list.filter((p) => p.enabled !== false);
    // Filter out providers without available models
    return list.filter((p) => getAvailableModels(p).length > 0);
  }, [getAvailableModels, modelConfig]);

  const formatModelLabel = useCallback((_provider: { platform?: string } | undefined, modelName?: string) => {
    return modelName || '';
  }, []);

  return { providers, getAvailableModels, formatModelLabel };
};
