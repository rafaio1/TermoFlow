import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type FeatureFlags = Record<string, boolean>;

export interface BrandingConfig {
  primary?: string;
  headerTextColor?: string;
  headerBg?: string;
  siderBg?: string;
  contentBg?: string;
  logo?: string;
  title?: string;
}

export interface AppConfig {
  GRAPHQL_URL: string;
  REST_BASE_URL: string;
  TENANT_ID?: string;
  USER_ID?: string;
  FEATURES?: FeatureFlags;
  BRANDING?: BrandingConfig;
}

interface AppConfigContextValue {
  config: AppConfig;
  loading: boolean;
  error?: string;
  refresh: () => void;
}

const AppConfigContext = createContext<AppConfigContextValue | undefined>(undefined);

const envFallbackConfig: AppConfig = {
  GRAPHQL_URL: process.env.REACT_APP_GRAPHQL_URL || '/api/graphql',
  REST_BASE_URL: process.env.REACT_APP_REST_BASE_URL || '/api',
  TENANT_ID: process.env.REACT_APP_TENANT_ID,
  USER_ID: process.env.REACT_APP_USER_ID,
  FEATURES: {},
  BRANDING: {
    primary: undefined,
    headerTextColor: undefined,
    headerBg: undefined,
    siderBg: undefined,
    contentBg: undefined,
    logo: undefined,
    title: undefined,
  },
};

function mergeConfig(base: AppConfig, override?: Partial<AppConfig>): AppConfig {
  if (!override) return base;
  return {
    ...base,
    ...override,
    FEATURES: { ...(base.FEATURES || {}), ...(override.FEATURES || {}) },
    BRANDING: { ...(base.BRANDING || {}), ...(override.BRANDING || {}) },
  };
}

export const AppConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(envFallbackConfig);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const res = await fetch('/app-config.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch app-config.json: ${res.status}`);
        const json = (await res.json()) as Partial<AppConfig>;
        if (!cancelled) {
          setConfig(mergeConfig(envFallbackConfig, json));
        }
      } catch (e: any) {
        // Se não existir o arquivo em produção, usamos apenas o fallback de env.
        if (!cancelled) {
          setConfig(envFallbackConfig);
          setError(e?.message || 'Unable to load configuration');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const value = useMemo<AppConfigContextValue>(() => ({
    config,
    loading,
    error,
    refresh: () => setReloadKey(k => k + 1),
  }), [config, loading, error]);

  // Acessibilidade: enquanto carrega, informar claramente o estado.
  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{ padding: 16 }}>
        Carregando aplicação...
      </div>
    );
  }

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
};

export function useAppConfig(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used within AppConfigProvider');
  return ctx;
}
