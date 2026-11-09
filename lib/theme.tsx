import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getTheme, saveTheme } from '@/lib/session';

export type ThemeMode = 'light' | 'dark';

export const palettes = {
  light: {
    page: '#F3F6FB',
    card: '#FFFFFF',
    navy: '#1B2744',
    muted: '#3F4A63',
    blue: '#1A5AD7',
    border: '#E8EEF6',
    iconBg: '#D7E8FB',
    tabBar: '#FFFFFF',
    overlay: 'rgba(27, 39, 68, 0.42)',
    menu: '#111111',
  },
  dark: {
    page: '#0F141E',
    card: '#1A2233',
    navy: '#F3F6FB',
    muted: '#C5CDD8',
    blue: '#4D8DFF',
    border: '#2A3548',
    iconBg: '#243044',
    tabBar: '#1A2233',
    overlay: 'rgba(0, 0, 0, 0.55)',
    menu: '#F3F6FB',
  },
};

type AppThemeValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: (typeof palettes)['light'];
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    getTheme().then((saved) => {
      if (saved === 'dark' || saved === 'light') {
        setMode(saved);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      void saveTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: palettes[mode],
      toggleTheme,
    }),
    [mode, toggleTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return context;
}
