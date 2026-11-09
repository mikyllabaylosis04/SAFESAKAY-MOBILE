const XENDIT_APP_RETURN_PATH = 'xendit-return';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (!path.includes(XENDIT_APP_RETURN_PATH)) {
    return path;
  }

  // While the app is open, the checkout screen that launched GCash is awaiting this link itself.
  if (!initial) {
    return null;
  }

  return path.replace(XENDIT_APP_RETURN_PATH, 'xendit-checkout');
}
