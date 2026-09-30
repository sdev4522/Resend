'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { api } from '@/lib/api/client';

export interface ThemeConfig {
  id?: string;
  name?: string;
  primary_light?: string;
  primary_dark?: string;
  secondary_light?: string;
  secondary_dark?: string;
  accent_light?: string;
  accent_dark?: string;
  background_default_light?: string;
  background_default_dark?: string;
  brandColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    [key: string]: any;
  };
  card?: {
    borderRadius?: number | string;
  };
  button?: {
    contained?: {
      borderRadius?: number | string;
    };
  };
  radius?: number | string;
  isCustomized?: boolean;
  [key: string]: any;
}

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

function getContrastForeground(hex?: string): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '#FFFFFF';
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length >= 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0a0a0a' : '#ffffff';
}

function applyThemeToDom(config: ThemeConfig | null) {
  if (typeof document === 'undefined') return;

  let styleTag = document.getElementById('wacrm-dynamic-theme') as HTMLStyleElement | null;

  if (!config || (config.id === 'default' && !config.isCustomized && !config.brandColors?.primary)) {
    if (styleTag) {
      styleTag.textContent = '';
    }
    return;
  }

  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'wacrm-dynamic-theme';
    document.head.appendChild(styleTag);
  }

  const primary = config.brandColors?.primary || config.primary_light;
  const primaryDark = config.brandColors?.primary || config.primary_dark || primary;
  const secondary = config.brandColors?.secondary || config.secondary_light;
  const secondaryDark = config.brandColors?.secondary || config.secondary_dark || secondary;
  const accent = config.brandColors?.accent || config.accent_light;
  const accentDark = config.brandColors?.accent || config.accent_dark || accent;

  const rawRadius = config.radius ?? config.card?.borderRadius ?? config.button?.contained?.borderRadius;
  let radiusStr: string | undefined;
  if (typeof rawRadius === 'number') {
    radiusStr = `${rawRadius}px`;
  } else if (typeof rawRadius === 'string' && rawRadius.trim()) {
    radiusStr = rawRadius;
  }

  const primaryFg = primary ? getContrastForeground(primary) : undefined;
  const primaryDarkFg = primaryDark ? getContrastForeground(primaryDark) : undefined;
  const secondaryFg = secondary ? getContrastForeground(secondary) : undefined;
  const secondaryDarkFg = secondaryDark ? getContrastForeground(secondaryDark) : undefined;

  let rootCss = '';
  let darkCss = '';

  if (primary) {
    rootCss += `  --primary: ${primary} !important;\n`;
    rootCss += `  --sidebar-primary: ${primary} !important;\n`;
    rootCss += `  --ring: ${primary} !important;\n`;
    if (primaryFg) {
      rootCss += `  --primary-foreground: ${primaryFg} !important;\n`;
      rootCss += `  --sidebar-primary-foreground: ${primaryFg} !important;\n`;
    }
  }

  if (secondary) {
    rootCss += `  --secondary: ${secondary} !important;\n`;
    if (secondaryFg) {
      rootCss += `  --secondary-foreground: ${secondaryFg} !important;\n`;
    }
  }

  if (accent) {
    rootCss += `  --accent: ${accent} !important;\n`;
  }

  if (radiusStr) {
    rootCss += `  --radius: ${radiusStr} !important;\n`;
  }

  if (primaryDark) {
    darkCss += `  --primary: ${primaryDark} !important;\n`;
    darkCss += `  --sidebar-primary: ${primaryDark} !important;\n`;
    darkCss += `  --ring: ${primaryDark} !important;\n`;
    if (primaryDarkFg) {
      darkCss += `  --primary-foreground: ${primaryDarkFg} !important;\n`;
      darkCss += `  --sidebar-primary-foreground: ${primaryDarkFg} !important;\n`;
    }
  }

  if (secondaryDark) {
    darkCss += `  --secondary: ${secondaryDark} !important;\n`;
    if (secondaryDarkFg) {
      darkCss += `  --secondary-foreground: ${secondaryDarkFg} !important;\n`;
    }
  }

  if (accentDark) {
    darkCss += `  --accent: ${accentDark} !important;\n`;
  }

  styleTag.textContent = `
:root {
${rootCss}}
.dark {
${darkCss}}
`;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const [themeConfig, setThemeConfig] = React.useState<ThemeConfig | null>(null);
  const [activeThemeId, setActiveThemeId] = React.useState<string>('default');
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
      applyThemeToDom(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    reloadTheme();
  }, [reloadTheme]);

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
