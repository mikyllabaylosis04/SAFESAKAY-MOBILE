import { File, Paths, UploadType } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';

import { getApiBaseUrls, getUploadBaseUrls, hydrateApiBase, rememberApiBase } from '@/lib/config';
import { getToken } from '@/lib/session';

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
};

export type UploadInput = {
  fileUri?: string | null;
  fieldName: string;
  mime?: string;
  name?: string;
  fields: Record<string, string>;
};

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  code?: string;
  organizationStatus?: string;
  organizationName?: string | null;

  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> = {},
    extras: { code?: string; organizationStatus?: string; organizationName?: string | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.code = extras.code;
    this.organizationStatus = extras.organizationStatus;
    this.organizationName = extras.organizationName;
  }

  firstError(): string {
    const values = Object.values(this.errors);
    return values[0]?.[0] ?? this.message;
  }

  isOrganizationInactive(): boolean {
    return this.status === 403 && this.code === 'ORGANIZATION_INACTIVE';
  }
}

export const OFFLINE_MESSAGE = 'No connection to SafeSakay. Check your internet and try again.';

function offlineError(devHint: string, status = 0): ApiError {
  if (__DEV__) {
    console.warn(`[api] ${devHint}`);
  }
  return new ApiError(OFFLINE_MESSAGE, status);
}

export function isOfflineError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) {
    return err.status === 0 ? OFFLINE_MESSAGE : err.firstError();
  }
  return fallback;
}

function isJsonContentType(value?: string | null): boolean {
  return (value ?? '').includes('application/json');
}

function parseApiPayload(body: string, status: number, contentType?: string | null) {
  const trimmed = body?.trim() ?? '';
  if (!isJsonContentType(contentType) && trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw offlineError(`Non-JSON response (HTTP ${status}). Reload Expo, then try again.`);
  }

  let json: {
    message?: string;
    errors?: Record<string, string[]>;
    code?: string;
    organization_status?: string;
    organization_name?: string | null;
  } = {};
  try {
    json = trimmed ? (JSON.parse(trimmed) as typeof json) : {};
  } catch {
    throw offlineError(`Invalid JSON response (HTTP ${status}). Reload Expo, then try again.`);
  }

  if (status < 200 || status >= 300) {
    throw new ApiError(
      json.message ?? 'Something went wrong. Please try again.',
      status,
      json.errors ?? {},
      {
        code: json.code,
        organizationStatus: json.organization_status,
        organizationName: json.organization_name,
      },
    );
  }

  return json;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  await hydrateApiBase();

  const targets = getApiBaseUrls();
  let lastNetworkError: ApiError | null = null;

  for (const base of targets) {
    let response: Response;

    try {
      response = await fetchWithTimeout(`${base}/api${path}`, init, timeoutMs);
    } catch {
      lastNetworkError = offlineError(`Cannot reach ${base}. Make sure Laravel and Expo are running.`);
      continue;
    }

    try {
      const text = await response.text();
      const json = parseApiPayload(text, response.status, response.headers.get('content-type'));
      rememberApiBase(base);
      return json as T;
    } catch (err) {
      if (err instanceof ApiError && err.status > 0) {
        throw err;
      }
      lastNetworkError =
        err instanceof ApiError
          ? err
          : offlineError(`Bad response from ${base} (HTTP ${response.status}).`);
    }
  }

  throw (
    lastNetworkError
    ?? offlineError(
      targets.length === 0
        ? 'No API base URL. Open the app from Expo Go on the same Wi-Fi as your PC, or set EXPO_PUBLIC_LARAVEL_API_BASE to http://YOUR-PC-IP:8000.'
        : 'Run Laravel with: php artisan serve --host=0.0.0.0 --port=8000',
    )
  );
}

function safeFileName(name?: string, mime?: string) {
  const fallback = mime?.includes('png') ? 'upload.png' : 'upload.jpg';
  return (name ?? fallback).replace(/[^a-zA-Z0-9._-]/g, '_') || fallback;
}

async function copyToCache(uri: string, name?: string, mime?: string): Promise<File> {
  const dest = new File(Paths.cache, `${Date.now()}-${safeFileName(name, mime)}`);
  await LegacyFS.copyAsync({ from: uri, to: dest.uri });
  return dest;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (options.auth !== false) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return requestJson<T>(
    path,
    {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    },
    options.timeoutMs ?? 8000,
  );
}

export async function apiUpload<T>(path: string, input: UploadInput): Promise<T> {
  if (!input.fileUri) {
    return api<T>(path, {
      method: 'POST',
      body: input.fields,
    });
  }

  await hydrateApiBase();

  const token = await getToken();
  const file = await copyToCache(input.fileUri, input.name, input.mime);
  const mime = input.mime === 'image/jpg' ? 'image/jpeg' : input.mime ?? 'image/jpeg';
  const targets = getUploadBaseUrls();
  let lastNetworkError: ApiError | null = null;

  for (const base of targets) {
    try {
      const result = await file.upload(`${base}/api${path}`, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName: input.fieldName,
        mimeType: mime,
        parameters: input.fields,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const contentType = result.headers?.['Content-Type'] ?? result.headers?.['content-type'];
      const json = parseApiPayload(result.body, result.status, contentType);
      rememberApiBase(base);
      return json as T;
    } catch (err) {
      if (err instanceof ApiError && err.status > 0) {
        throw err;
      }
      lastNetworkError = offlineError(`Upload to ${base} failed. Make sure Laravel and Expo are running.`);
    }
  }

  throw lastNetworkError ?? offlineError('Upload failed. Reload Expo and try again.');
}
