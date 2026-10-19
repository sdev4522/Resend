'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { api } from '@/lib/api/client';

import {
  ThemeConfig,
  getContrastForeground,
  generateThemeCss,
} from '@/lib/theme/theme-utils';

export type { ThemeConfig };
export { getContrastForeground, generateThemeCss };

interface ThemeContextType {
  themeConfig: ThemeConfig | null;
  activeThemeId: string;
  isLoading: boolean;
  reloadTheme: () => Promise<void>;
  applyPreview: (config: ThemeConfig | null) => void;
  resetToDefault: () => Promise<void>;
}

const GlobalThemeContext = React.createContext<ThemeContextType>({
  themeConfig: null,
  activeThemeId: 'default',
  isLoading: false,
  reloadTheme: async () => {},
  applyPreview: () => {},
  resetToDefault: async () => {},
});

export const useGlobalTheme = () => React.useContext(GlobalThemeContext);

function applyThemeToDom(config: ThemeConfig | null) {
  if (typeof document === 'undefined') return;

  let styleTag = document.getElementById('wacrm-dynamic-theme') as HTMLStyleElement | null;

  if (!config) {
    if (styleTag) {
      styleTag.textContent = '';
    }
    try {
      localStorage.removeItem('wacrm_theme_css');
      localStorage.removeItem('wacrm_theme_config');
    } catch {}
    return;
  }

  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'wacrm-dynamic-theme';
    document.head.appendChild(styleTag);
  }

  const generatedCss = generateThemeCss(config);
  styleTag.textContent = generatedCss;

  try {
    localStorage.setItem('wacrm_theme_css', generatedCss);
    localStorage.setItem('wacrm_theme_config', JSON.stringify(config));
  } catch {}
}

export interface ThemeProviderProps extends React.ComponentProps<typeof NextThemesProvider> {
  initialConfig?: ThemeConfig | null;
}

export function ThemeProvider({
  children,
  initialConfig = null,
  ...props
}: ThemeProviderProps) {
  const [themeConfig, setThemeConfig] = React.useState<ThemeConfig | null>(initialConfig);
  const [activeThemeId, setActiveThemeId] = React.useState<string>(initialConfig?.id || 'default');
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  const reloadTheme = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; data: any }>('/api/theme/get-theme-config');
      if (res && res.success && res.data) {
        setThemeConfig(res.data);
        setActiveThemeId(res.data.id || 'default');
        applyThemeToDom(res.data);
      }
    } catch {
      // If fetching fails on client, retain current initialConfig if present
      if (!initialConfig) {
        applyThemeToDom(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [initialConfig]);

  const applyPreview = React.useCallback((config: ThemeConfig | null) => {
    applyThemeToDom(config);
  }, []);

  const resetToDefault = React.useCallback(async () => {
    try {
      applyThemeToDom(null);
      setThemeConfig(null);
      setActiveThemeId('default');
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    // If initialConfig was supplied by SSR, ensure localStorage is synced immediately
    if (initialConfig) {
      try {
        const css = generateThemeCss(initialConfig);
        localStorage.setItem('wacrm_theme_css', css);
        localStorage.setItem('wacrm_theme_config', JSON.stringify(initialConfig));
      } catch {}
    }
    reloadTheme();
  }, [initialConfig, reloadTheme]);

  return (
    <NextThemesProvider {...props}>
      <GlobalThemeContext.Provider
        value={{
          themeConfig,
          activeThemeId,
          isLoading,
          reloadTheme,
          applyPreview,
          resetToDefault,
        }}
      >
        {children}
      </GlobalThemeContext.Provider>
    </NextThemesProvider>
  );
}
