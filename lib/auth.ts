import { api, ApiError, apiUpload } from '@/lib/api';
import { removePushTokenFromServer } from '@/lib/push-notifications';
import { clearSession, getUserJson, saveToken, saveUser } from '@/lib/session';
import type { AuthResponse, AuthUser, Organization } from '@/lib/types';

export async function fetchOrganizations(): Promise<Organization[]> {
  const response = await api<{ data: Organization[] }>('/organizations', { auth: false });
  return response.data;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  address?: string;
  contact_number?: string;
  organization_id?: number;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await api('/register', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api('/forgot-password', {
    method: 'POST',
    auth: false,
    body: { email },
  });
}

export async function verifyResetCode(email: string, code: string): Promise<void> {
  await api('/verify-reset-code', {
    method: 'POST',
    auth: false,
    body: { email, code },
  });
}

export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await api('/reset-password', {
    method: 'POST',
    auth: false,
    body: input,
  });
}

function loginUsernames(raw: string): string[] {
  const trimmed = raw.trim();
  const values = [trimmed];

  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    const local = email.split('@')[0]?.replace(/\./g, '') ?? '';
    values.push(email);
    if (local) {
      values.push(local);
    }
  }

  return [...new Set(values.filter(Boolean))];
}

function isWrongLogin(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 422) {
    return false;
  }

  return `${err.message} ${err.firstError()}`.toLowerCase().includes('username or password is incorrect');
}

export async function loginAccount(input: {
  username: string;
  password: string;
}): Promise<AuthUser> {
  const candidates = loginUsernames(input.username);
  let lastError: unknown;

  for (const username of candidates) {
    try {
      const response = await api<AuthResponse>('/login', {
        method: 'POST',
        auth: false,
        body: { username, password: input.password },
      });
      await saveSession(response);
      return response.user;
    } catch (err) {
      lastError = err;
      if (!isWrongLogin(err)) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Login failed. Please try again.');
}

export async function logoutAccount(): Promise<void> {
  await removePushTokenFromServer();

  try {
    await api('/logout', { method: 'POST' });
  } catch {
    // Still clear the local session if the server is unreachable.
  }

  await clearSession();
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await getUserJson();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await api<{ user: AuthUser }>('/me');
    await saveUser(JSON.stringify(response.user));
    return response.user;
  } catch {
    return getStoredUser();
  }
}

export async function updateName(name: string): Promise<AuthUser> {
  const response = await api<{ user: AuthUser }>('/me/name', {
    method: 'PATCH',
    body: { name },
  });

  await saveUser(JSON.stringify(response.user));
  return response.user;
}

export async function updatePassword(input: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await api('/me/password', {
    method: 'PATCH',
    body: input,
  });
}

export type ProfileInput = {
  name: string;
  email: string;
  address?: string;
  contact_number?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
};

export async function updateProfile(input: ProfileInput): Promise<AuthUser> {
  const response = await api<{ user: AuthUser }>('/me', {
    method: 'PATCH',
    body: input,
  });

  await saveUser(JSON.stringify(response.user));
  return response.user;
}

export async function updateProfilePhoto(uri: string, mime?: string | null): Promise<AuthUser> {
  const response = await apiUpload<{ user: AuthUser }>('/me/photo', {
    fileUri: uri,
    fieldName: 'photo',
    mime: mime ?? 'image/jpeg',
    name: 'profile.jpg',
    fields: {},
  });

  await saveUser(JSON.stringify(response.user));
  return response.user;
}

export type HelpSection = { heading: string; body: string };

export type HelpPolicy = {
  key: 'rental' | 'terms' | 'privacy';
  title: string;
  summary: string;
  version: string;
  sections: HelpSection[];
};

export type HelpHotline = { label: string; number: string; description: string };

export type HelpContent = {
  barangay: { name: string | null; address: string | null; contact_number: string | null };
  hotlines: HelpHotline[];
  faq: { question: string; answer: string }[];
  policies: HelpPolicy[];
};

export async function fetchHelpContent(organizationId?: number | null): Promise<HelpContent> {
  const query = organizationId ? `?organization_id=${organizationId}` : '';
  const response = await api<{ data: HelpContent }>(`/help${query}`);
  return response.data;
}

export async function setServiceArea(organizationId: number): Promise<AuthUser> {
  const response = await api<{ user: AuthUser }>('/me/service-area', {
    method: 'PATCH',
    body: { organization_id: organizationId },
  });

  await saveUser(JSON.stringify(response.user));
  return response.user;
}

async function saveSession(response: AuthResponse): Promise<void> {
  await saveToken(response.token);
  await saveUser(JSON.stringify(response.user));
}
