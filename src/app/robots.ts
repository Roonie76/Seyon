import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Crawler policy, stated rather than inherited.
 *
 * Everything below was already the effective behaviour under a bare
 * `User-Agent: *` — the point of writing it out is that allowing AI crawlers is
 * now a decision on the record rather than a default nobody chose. If Seyon
 * ever wants out of model training, this is the one file to change, and the
 * comment explains what changing it costs.
 *
 * The assistant crawlers do two different jobs and it is worth not confusing
 * them:
 *
 *   GPTBot, ClaudeBot, PerplexityBot, CCBot   may use pages for training
 *   OAI-SearchBot, Claude-User, Google-Extended  fetch pages to answer a live
 *                                                question, and are the reason
 *                                                an assistant can cite Seyon
 *                                                today rather than in a year
 *
 * Blocking the first group costs nothing this quarter and everything in two
 * years. Blocking the second group makes Seyon uncitable immediately.
 */

const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
  'Applebot-Extended',
  'Bytespider',
  'meta-externalagent',
];

/**
 * Never worth indexing: authenticated surfaces, and endpoints that return data
 * rather than pages. /api in particular would otherwise expose the health check
 * and the cron route to crawlers as though they were content.
 */
const PRIVATE = ['/dashboard/', '/admin/', '/api/', '/login', '/account', '/shopper-account', '/seller-account'];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL;

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      // Same policy, named explicitly, so a future reader can see it was meant.
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow: PRIVATE })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
