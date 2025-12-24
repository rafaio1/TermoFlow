import { loadRegistryStore } from '../controllers/registry';
import { getCurrentContext } from './access';

export type Branding = {
  appName: string;
  logoDataUrl: string | null;
  primaryColor: string;
  headerBg: string;
  headerTextColor: string;
  siderBg: string;
  siderTextColor: string;
  siderActiveBg: string;
  siderActiveTextColor: string;
  contentBg: string;
};

type BrandingState = {
  version: 1;
  byTenantId: Record<string, Branding>;
};

const STORAGE_KEY = 'termoflow.branding.v1';

export const DEFAULT_BRANDING: Branding = {
  appName: 'TermoFlow',
  logoDataUrl: null,
  primaryColor: '#1a73e8',
  headerBg: '#ffffff',
  headerTextColor: '#202124',
  siderBg: '#ffffff',
  siderTextColor: '#3c4043',
  siderActiveBg: '#e8f0fe',
  siderActiveTextColor: '#1a73e8',
  contentBg: '#f8f9fa'
};

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch (_err) {
    return false;
  }
}

function readRaw(): string | null {
  if (!hasLocalStorage()) return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function writeRaw(value: string): void {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, value);
}

function emitBrandingUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent('termoflow:branding-updated'));
  } catch (_err) {
    // ignore
  }
}

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeBranding(input: any): Branding {
  return {
    appName: typeof input?.appName === 'string' && input.appName.trim() ? input.appName.trim() : DEFAULT_BRANDING.appName,
    logoDataUrl: typeof input?.logoDataUrl === 'string' && input.logoDataUrl ? input.logoDataUrl : null,
    primaryColor: normalizeColor(input?.primaryColor, DEFAULT_BRANDING.primaryColor),
    headerBg: normalizeColor(input?.headerBg, DEFAULT_BRANDING.headerBg),
    headerTextColor: normalizeColor(input?.headerTextColor, DEFAULT_BRANDING.headerTextColor),
    siderBg: normalizeColor(input?.siderBg, DEFAULT_BRANDING.siderBg),
    siderTextColor: normalizeColor(input?.siderTextColor, DEFAULT_BRANDING.siderTextColor),
    siderActiveBg: normalizeColor(input?.siderActiveBg, DEFAULT_BRANDING.siderActiveBg),
    siderActiveTextColor: normalizeColor(input?.siderActiveTextColor, DEFAULT_BRANDING.siderActiveTextColor),
    contentBg: normalizeColor(input?.contentBg, DEFAULT_BRANDING.contentBg)
  };
}

function loadBrandingState(): BrandingState {
  const raw = readRaw();
  if (!raw) return { version: 1, byTenantId: {} };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { version: 1, byTenantId: {} };
    const byTenantId = parsed.byTenantId && typeof parsed.byTenantId === 'object' ? parsed.byTenantId : {};

    const normalized: Record<string, Branding> = {};
    Object.keys(byTenantId).forEach(tenantId => {
      normalized[tenantId] = normalizeBranding(byTenantId[tenantId]);
    });

    return { version: 1, byTenantId: normalized };
  } catch (_err) {
    return { version: 1, byTenantId: {} };
  }
}

export function getCurrentTenantId(): string | null {
  const store = loadRegistryStore();
  return store.ui.currentTenantId || (store.tenants.find(t => t.deletedAt === null)?.id ?? null);
}

export function loadBrandingForTenant(tenantId: string | null): Branding {
  if (!tenantId) return DEFAULT_BRANDING;
  const state = loadBrandingState();
  return state.byTenantId[tenantId] || DEFAULT_BRANDING;
}

export function saveBrandingForTenant(tenantId: string, branding: Branding): void {
  const state = loadBrandingState();
  const next: BrandingState = {
    version: 1,
    byTenantId: { ...state.byTenantId, [tenantId]: normalizeBranding(branding) }
  };
  writeRaw(JSON.stringify(next));
  emitBrandingUpdated();
}

export function resetBrandingForTenant(tenantId: string): void {
  const state = loadBrandingState();
  const { [tenantId]: _removed, ...rest } = state.byTenantId;
  writeRaw(JSON.stringify({ version: 1, byTenantId: rest }));
  emitBrandingUpdated();
}

export function applyBrandingToDom(branding: Branding): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--tf-primary-color', branding.primaryColor);
  root.style.setProperty('--tf-header-bg', branding.headerBg);
  root.style.setProperty('--tf-header-text', branding.headerTextColor);
  root.style.setProperty('--tf-sider-bg', branding.siderBg);
  root.style.setProperty('--tf-sider-text', branding.siderTextColor);
  root.style.setProperty('--tf-sider-active-bg', branding.siderActiveBg);
  root.style.setProperty('--tf-sider-active-text', branding.siderActiveTextColor);
  root.style.setProperty('--tf-content-bg', branding.contentBg);

  document.title = branding.appName;
}

export function applyBrandingForCurrentTenant(): Branding {
  const { tenantId } = getCurrentContext();
  const branding = loadBrandingForTenant(tenantId);
  applyBrandingToDom(branding);
  return branding;
}
