import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url.replace(/\/+$/, '');

  const publicAllowedPaths = [
    '/',
    '/features',
    '/pricing',
    '/contact',
    '/faq',
    '/privacy',
    '/terms',
  ];

  // Auth, onboarding and thank-you pages are NOT blocked here on purpose: they carry
  // <meta name="robots" content="noindex">, and crawlers must be able to fetch a page
  // to see that tag. Blocking them would let bare URLs be indexed.
  const privateDisallowedPaths = ['/dashboard/', '/admin/', '/api/'];

  const verifiedAgents = [
    '*',
    'Googlebot',
    'Bingbot',
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'PerplexityBot',
    'Google-Extended',
  ];

  return {
    rules: verifiedAgents.map((userAgent) => ({
      userAgent,
      allow: publicAllowedPaths,
      disallow: privateDisallowedPaths,
    })),
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
