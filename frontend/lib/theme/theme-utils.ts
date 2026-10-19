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
  background_paper_light?: string;
  background_paper_dark?: string;
  text_primary_light?: string;
  text_primary_dark?: string;
  text_secondary_light?: string;
  text_secondary_dark?: string;
  border_light?: string;
  border_dark?: string;
  divider_light?: string;
  divider_dark?: string;
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

export function getContrastForeground(hex?: string): string {
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

export function generateThemeCss(config: ThemeConfig | null): string {
  if (!config) return '';

  const primary = config.brandColors?.primary || config.primary_light;
  const primaryDark = config.brandColors?.primary || config.primary_dark || primary;
  const secondary = config.brandColors?.secondary || config.secondary_light;
  const secondaryDark = config.brandColors?.secondary || config.secondary_dark || secondary;
  const accent = config.brandColors?.accent || config.accent_light;
  const accentDark = config.brandColors?.accent || config.accent_dark || accent;

  const bgLight = config.background_default_light;
  const bgDark = config.background_default_dark;
  const paperLight = config.background_paper_light;
  const paperDark = config.background_paper_dark;

  const textPrimaryLight = config.text_primary_light;
  const textPrimaryDark = config.text_primary_dark;
  const textSecondaryLight = config.text_secondary_light;
  const textSecondaryDark = config.text_secondary_dark;

  const borderLight = config.border_light || config.divider_light;
  const borderDark = config.border_dark || config.divider_dark;

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
  const accentFg = accent ? getContrastForeground(accent) : undefined;
  const accentDarkFg = accentDark ? getContrastForeground(accentDark) : undefined;

  let rootCss = '';
  let darkCss = '';

  // PRIMARY & CONTRAST
  if (primary) {
    rootCss += `  --primary: ${primary} !important;\n`;
    rootCss += `  --sidebar-primary: ${primary} !important;\n`;
    rootCss += `  --ring: ${primary} !important;\n`;
    if (primaryFg) {
      rootCss += `  --primary-foreground: ${primaryFg} !important;\n`;
      rootCss += `  --sidebar-primary-foreground: ${primaryFg} !important;\n`;
    }
  }

  // SECONDARY
  if (secondary) {
    rootCss += `  --secondary: ${secondary} !important;\n`;
    if (secondaryFg) {
      rootCss += `  --secondary-foreground: ${secondaryFg} !important;\n`;
    }
  }

  // ACCENT
  if (accent) {
    rootCss += `  --accent: ${accent} !important;\n`;
    if (accentFg) {
      rootCss += `  --accent-foreground: ${accentFg} !important;\n`;
    }
  }

  // BACKGROUND & CARDS (LIGHT)
  if (bgLight) {
    rootCss += `  --background: ${bgLight} !important;\n`;
    rootCss += `  --sidebar: ${paperLight || bgLight} !important;\n`;
  }
  if (paperLight) {
    rootCss += `  --card: ${paperLight} !important;\n`;
    rootCss += `  --popover: ${paperLight} !important;\n`;
  }

  // TEXT & LABELS (LIGHT)
  if (textPrimaryLight) {
    rootCss += `  --foreground: ${textPrimaryLight} !important;\n`;
    rootCss += `  --card-foreground: ${textPrimaryLight} !important;\n`;
    rootCss += `  --popover-foreground: ${textPrimaryLight} !important;\n`;
    rootCss += `  --sidebar-foreground: ${textPrimaryLight} !important;\n`;
  }
  if (textSecondaryLight) {
    rootCss += `  --muted-foreground: ${textSecondaryLight} !important;\n`;
  }

  // BORDERS & INPUTS (LIGHT)
  if (borderLight) {
    rootCss += `  --border: ${borderLight} !important;\n`;
    rootCss += `  --input: ${borderLight} !important;\n`;
    rootCss += `  --sidebar-border: ${borderLight} !important;\n`;
  }

  // RADIUS
  if (radiusStr) {
    rootCss += `  --radius: ${radiusStr} !important;\n`;
  }

  // DARK THEME TOKENS
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
    if (accentDarkFg) {
      darkCss += `  --accent-foreground: ${accentDarkFg} !important;\n`;
    }
  }

  if (bgDark) {
    darkCss += `  --background: ${bgDark} !important;\n`;
    darkCss += `  --sidebar: ${paperDark || bgDark} !important;\n`;
  }
  if (paperDark) {
    darkCss += `  --card: ${paperDark} !important;\n`;
    darkCss += `  --popover: ${paperDark} !important;\n`;
  }
  if (textPrimaryDark) {
    darkCss += `  --foreground: ${textPrimaryDark} !important;\n`;
    darkCss += `  --card-foreground: ${textPrimaryDark} !important;\n`;
    darkCss += `  --popover-foreground: ${textPrimaryDark} !important;\n`;
    darkCss += `  --sidebar-foreground: ${textPrimaryDark} !important;\n`;
  }
  if (textSecondaryDark) {
    darkCss += `  --muted-foreground: ${textSecondaryDark} !important;\n`;
  }
  if (borderDark) {
    darkCss += `  --border: ${borderDark} !important;\n`;
    darkCss += `  --input: ${borderDark} !important;\n`;
    darkCss += `  --sidebar-border: ${borderDark} !important;\n`;
  }

  return `
:root {
${rootCss}}
.dark {
${darkCss}}
`;
}
