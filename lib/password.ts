export const PASSWORD_HINT =
  'At least 8 characters, with uppercase and lowercase letters, a number, and a special character (! @ # $ %).';

export function passwordStrengthError(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    return 'Password must include uppercase and lowercase letters.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must include a number.';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include a special character (! @ # $ %).';
  }

  return null;
}
