import fs from 'fs';
import path from 'path';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_API_URL ||
  'http://localhost:3001';
import type { ThemeConfig } from './theme-utils';

/**
 * Server-side theme loader for Next.js App Router.
 * Retrieves authoritative theme configuration from backend API,
 * with graceful local filesystem fallback if running on the same host or during offline build.
 */
export async function getActiveThemeConfigServer(): Promise<ThemeConfig | null> {
  // 1. Primary: Attempt HTTP fetch to backend API endpoint
  try {
    const res = await fetch(`${API_BASE_URL}/api/theme/get-theme-config`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        return json.data as ThemeConfig;
      }
    }
  } catch {
    // Backend API might be unreachable, offline, or Next.js is pre-rendering at build time
  }

  // 2. Fallback: If running in Node.js environment where backend/routes/themes is on disk
  try {
    const candidateDirs = [
      path.resolve(process.cwd(), 'backend/routes/themes'),
      path.resolve(process.cwd(), '../backend/routes/themes'),
    ];
    const themesDir = candidateDirs.find((dir) => fs.existsSync(dir));

    if (themesDir) {
      const activeFilePath = path.join(themesDir, 'active-theme.json');

    if (fs.existsSync(activeFilePath)) {
      const activeData = JSON.parse(fs.readFileSync(activeFilePath, 'utf8'));
      const activeThemeId = activeData?.activeThemeId || 'default';
      const themeFilePath = path.join(themesDir, `${activeThemeId}.json`);

        if (fs.existsSync(themeFilePath)) {
          const themeConfig = JSON.parse(fs.readFileSync(themeFilePath, 'utf8'));
          return {
            ...themeConfig,
            id: themeConfig.id || activeThemeId,
          } as ThemeConfig;
        }
      }
    }
  } catch {
    // Local filesystem fallback failed or not available in current environment
  }

  return null;
}
