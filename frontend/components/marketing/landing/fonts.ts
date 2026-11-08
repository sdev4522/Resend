import { Anek_Latin } from 'next/font/google';

/**
 * Display face for landing headlines only (body stays Golos Text, matching the app).
 * Anek is from Ek Type (Mumbai); its width axis lets headlines run condensed and heavy.
 */
export const lpDisplay = Anek_Latin({
  variable: '--font-lp-display',
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
});
