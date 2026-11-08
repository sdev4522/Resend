import { Plus_Jakarta_Sans } from 'next/font/google';

/** Display face for landing headlines only (body stays Golos Text, matching the app). */
export const lpDisplay = Plus_Jakarta_Sans({
  variable: '--font-lp-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
});
