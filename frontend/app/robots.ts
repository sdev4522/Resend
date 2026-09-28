import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url.replace(/\/+$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/features',
          '/pricing',
          '/contact',
          '/faq',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/onboarding/',
          '/login',
          '/register',
          '/forgot-password',
          '/recovery-user/',
          '/verify-email',
          '/thank-you',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
