
import {
  useFocusEffect,
  usePathname,
  useRouter,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { AppState } from 'react-native';

import { ApiError } from '@/lib/api';

import {
  fetchCurrentUser,
  getStoredUser,
} from '@/lib/auth';

import { getToken } from '@/lib/session';

import type {
  AuthUser,
  Organization,
} from '@/lib/types';

// FIX: Define valid navigation destinations.
// This prevents passing an unrestricted string
// to Expo Router's typed navigation.
type OrganizationDestination =
  | '/login'
  | '/organization-inactive'
  | '/organization-unavailable'
  | '/operator-home'
  | '/homepage';

function userIsOperator(
  user?: AuthUser | null,
): boolean {
  const value = (user?.role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return (
    value === 'operator' ||
    value === 'boat_operator'
  );
}

export function organizationStatus(
  user?: AuthUser | Organization | null,
): string {
  if (!user) {
    return 'active';
  }

  if ('organization' in user) {
    return (
      user.organization?.status ??
      (
        user.organization?.allows_operations === false
          ? 'archived'
          : 'active'
      )
    );
  }

  return (
    user.status ??
    (
      user.allows_operations === false
        ? 'archived'
        : 'active'
    )
  );
}

export function organizationAllowsOperations(
  user?: AuthUser | null,
): boolean {
  if (!user?.organization) {
    return true;
  }

  if (
    typeof user.organization.allows_operations ===
    'boolean'
  ) {
    return user.organization.allows_operations;
  }

  return organizationStatus(user) === 'active';
}

export function organizationDisplayName(
  user?: AuthUser | null,
): string {
  return (
    user?.organization?.name?.trim() ||
    'This organization'
  );
}

export function organizationStatusLabel(
  user?: AuthUser | null,
): string {
  if (user?.organization?.status_label) {
    return user.organization.status_label;
  }

  const status = organizationStatus(user);

  if (status === 'archived') {
    return 'Archived';
  }

  if (status === 'suspended') {
    return 'Suspended';
  }

  if (status === 'pending') {
    return 'Pending';
  }

  if (status === 'inactive') {
    return 'Inactive';
  }

  return 'Active';
}

export function isPassengerRentalPath(
  pathname?: string | null,
): boolean {
  return (
    pathname === '/boats' ||
    pathname === '/rent-boat'
  );
}

// FIX: Return only known valid Expo Router paths.
export function destinationForOrganization(
  user: AuthUser | null,
  pathname?: string | null,
): OrganizationDestination | null {
  if (!user) {
    return '/login';
  }

  if (userIsOperator(user)) {
    if (
      !organizationAllowsOperations(user) &&
      pathname !== '/organization-inactive'
    ) {
      return '/organization-inactive';
    }

    if (
      organizationAllowsOperations(user) &&
      pathname === '/organization-inactive'
    ) {
      return '/operator-home';
    }

    return null;
  }

  if (
    !organizationAllowsOperations(user) &&
    isPassengerRentalPath(pathname)
  ) {
    return '/organization-unavailable';
  }

  if (
    organizationAllowsOperations(user) &&
    pathname === '/organization-unavailable'
  ) {
    return '/homepage';
  }

  return null;
}

export function useOrganizationSessionGuard() {
  const router = useRouter();

  const pathname = usePathname();

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state !== 'active') {
          return;
        }

        void (async () => {
          const token = await getToken();

          if (!token) {
            return;
          }

          const user = await fetchCurrentUser();

          const next = destinationForOrganization(
            user,
            pathname,
          );

          if (next) {
            router.replace(next);
          }
        })();
      },
    );

    return () => subscription.remove();
  }, [pathname, router]);
}

export function useRequireActiveOrganization(
  kind: 'operator' | 'passenger-rental',
) {
  const router = useRouter();

  const [allowed, setAllowed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const stored = await getStoredUser();

        if (!active) {
          return;
        }

        if (
          kind === 'operator' &&
          stored &&
          !organizationAllowsOperations(stored)
        ) {
          router.replace('/organization-inactive');
          return;
        }

        if (
          kind === 'passenger-rental' &&
          stored &&
          !organizationAllowsOperations(stored)
        ) {
          router.replace('/organization-unavailable');
          return;
        }

        try {
          const user = await fetchCurrentUser();

          if (!active) {
            return;
          }

          if (!user) {
            router.replace('/login');
            return;
          }

          if (
            kind === 'operator' &&
            !organizationAllowsOperations(user)
          ) {
            router.replace('/organization-inactive');
            return;
          }

          if (
            kind === 'passenger-rental' &&
            !organizationAllowsOperations(user)
          ) {
            router.replace('/organization-unavailable');
            return;
          }

          setAllowed(true);
        } catch (err) {
          if (
            err instanceof ApiError &&
            err.isOrganizationInactive()
          ) {
            router.replace(
              kind === 'operator'
                ? '/organization-inactive'
                : '/organization-unavailable',
            );

            return;
          }

          setAllowed(true);
        }
      })();

      return () => {
        active = false;
      };
    }, [kind, router]),
  );

  return allowed;
}
