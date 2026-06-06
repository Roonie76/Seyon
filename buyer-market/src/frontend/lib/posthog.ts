import posthog from 'posthog-js';

// Client-side initialization
export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (key && !key.includes('mock-')) {
      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
        capture_pageview: false,
      });
    } else {
      console.log('PostHog Mock Initialized (client-side)');
    }
  }
};

export { posthog };

