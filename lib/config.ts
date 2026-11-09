import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

import { getApiBase, saveApiBase } from '@/lib/session';

let rememberedBase: string | null = null;
let hydratePromise: Promise<void> | null = null;

function usableLanIp(ip?: string | null): string | null {
  if (!ip || ip.startsWith('127.') || ip.startsWith('169.254.') || ip.startsWith('192.168.56.')) {
    return null;
  }

  return ip;
}

function ipv4From(value?: string | null): string | null {
  return usableLanIp(value?.match(/(\d{1,3}(?:\.\d{1,3}){3})/)?.[1]);
}

function metroProxyBases(): string[] {
  const sources = [
    NativeModules.SourceCode?.scriptURL,
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
  ];
  const bases: string[] = [];

  for (const source of sources) {
    const match = source?.match(/(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})/);
    const ip = usableLanIp(match?.[1]);

    if (!ip || !match?.[2]) {
      continue;
    }

    bases.push(`http://${ip}:${match[2]}`);
  }

  return [...new Set(bases)];
}

function liveLanHosts(): string[] {
  const hosts = [
    ipv4From(NativeModules.SourceCode?.scriptURL),
    ipv4From(Constants.expoGoConfig?.debuggerHost),
    ipv4From(Constants.expoConfig?.hostUri),
    ipv4From(Constants.linkingUri),
  ].filter((value): value is string => Boolean(value));

  return [...new Set(hosts)];
}

function hostOf(base: string): string | null {
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

const LARAVEL_PORT = 8000;

function laravelBaseForHost(host: string): string {
  return `http://${host}:${LARAVEL_PORT}`;
}

function isPrivateLanHost(host: string): boolean {
  return (
    host.startsWith('192.168.')
    || host.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function normalizeApiBase(base: string): string | null {
  try {
    const url = new URL(base);

    if (url.port === '') {
      url.port = String(LARAVEL_PORT);
    }

    return url.origin;
  } catch {
    return null;
  }
}

function configuredApiBaseOverride(): string | null {
  const extra = Constants.expoConfig?.extra?.laravelApiBase;

  if (typeof extra === 'string' && extra.trim() !== '') {
    return normalizeApiBase(extra.trim()) ?? extra.trim().replace(/\/$/, '');
  }

  const envBase = process.env.EXPO_PUBLIC_LARAVEL_API_BASE
    ?? process.env.EXPO_PUBLIC_API_URL;

  if (typeof envBase === 'string' && envBase.trim() !== '') {
    return normalizeApiBase(envBase.trim()) ?? envBase.trim().replace(/\/$/, '');
  }

  return null;
}

export async function hydrateApiBase(): Promise<void> {
  if (hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = getApiBase()
    .then((base) => {
      if (! base) {
        return;
      }

      const normalized = normalizeApiBase(base);

      if (! normalized) {
        return;
      }

      const host = hostOf(normalized);

      if (host && (isPrivateLanHost(host) || liveLanHosts().includes(host))) {
        rememberedBase = normalized;
      }
    })
    .catch(() => undefined);

  return hydratePromise;
}

export function rememberApiBase(base: string): void {
  const normalized = normalizeApiBase(base) ?? base;

  if (rememberedBase === normalized) {
    return;
  }

  const host = hostOf(normalized);

  if (! host) {
    return;
  }

  if (Platform.OS !== 'web' && ! isPrivateLanHost(host) && ! liveLanHosts().includes(host)) {
    return;
  }

  rememberedBase = normalized;
  void saveApiBase(normalized);
}

export function getApiBaseUrls(): string[] {
  const urls: string[] = [];

  if (Platform.OS === 'web') {
    return ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:8000'];
  }

  for (const base of metroProxyBases()) {
    urls.push(base);
  }

  const override = configuredApiBaseOverride();

  if (override) {
    urls.push(override);
  }

  if (rememberedBase) {
    urls.push(rememberedBase);
  }

  for (const host of liveLanHosts()) {
    urls.push(laravelBaseForHost(host));
  }

  return [...new Set(urls)];
}

export function getUploadBaseUrls(): string[] {
  return getApiBaseUrls();
}

export function getApiBaseUrl(): string {
  return rememberedBase ?? getApiBaseUrls()[0];
}

export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  const origin = getApiBaseUrl();

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/storage/')) {
      return `${origin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    if (url.startsWith('/')) {
      return `${origin}${url}`;
    }
  }

  return url;
}
