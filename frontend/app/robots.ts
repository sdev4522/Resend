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

  const privateDisallowedPaths = [
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
  ];

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
