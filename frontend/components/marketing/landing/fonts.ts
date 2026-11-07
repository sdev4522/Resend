import { Schibsted_Grotesk } from 'next/font/google';

/** Display face for landing headlines only (body stays Golos Text, matching the app). */
export const lpDisplay = Schibsted_Grotesk({
  variable: '--font-lp-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
});
