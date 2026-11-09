import { organizationAllowsOperations } from '@/lib/organization-access';
import type { AuthUser } from '@/lib/types';

export type AppRole = 'passenger' | 'operator' | 'admin';
export type HomeHref = '/homepage' | '/operator-home' | '/organization-inactive';

export function normalizeRole(role?: string | null): AppRole {
  const value = (role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (value === 'operator' || value === 'boat_operator') {
    return 'operator';
  }

  if (value === 'admin' || value === 'administrator') {
    return 'admin';
  }

  return 'passenger';
}

export function isOperator(user?: AuthUser | null): boolean {
  return normalizeRole(user?.role) === 'operator';
}

export function roleLabel(role?: string | null): string {
  const normalized = normalizeRole(role);

  if (normalized === 'operator') {
    return 'Boat Operator';
  }

  if (normalized === 'admin') {
    return 'Admin';
  }

  return 'Passenger';
}

export function homeHrefForUser(user?: AuthUser | null): HomeHref {
  if (isOperator(user) && !organizationAllowsOperations(user)) {
    return '/organization-inactive';
  }

  return isOperator(user) ? '/operator-home' : '/homepage';
}
