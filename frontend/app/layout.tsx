import type { Metadata, Viewport } from 'next';
import { Golos_Text, Geist_Mono } from 'next/font/google';
import './globals.css';
import { RootProvider } from '@/components/providers/root-provider';
import { CookieConsent } from '@/components/shared/cookie-consent';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { siteConfig } from '@/config/site';

const golosText = Golos_Text({
  variable: '--font-golos-text',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — WhatsApp CRM, Automation & Multi-Agent Inbox`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: 'Resend Team' }],
  creator: 'Resend Inc.',
  publisher: 'Resend Inc.',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '48x48' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — WhatsApp CRM, Automation & Multi-Agent Inbox`,
    description: siteConfig.description,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — WhatsApp CRM & Automation Platform`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — WhatsApp CRM, Automation & Multi-Agent Inbox`,
    description: siteConfig.description,
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${golosText.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <RootProvider>
          <AnalyticsProvider>
            {children}
            <CookieConsent />
          </AnalyticsProvider>
        </RootProvider>
      </body>
    </html>
  );
}
