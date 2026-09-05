import * as React from 'react';
import type { Metadata } from 'next';
import { getSession } from '@/backend/lib/session';
import { ContactClient } from '@/components/help/ContactClient';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the Seyon support team. Reach out to us via email — we typically respond within 24 hours.',
};

export default async function ContactPage() {
  const session = await getSession();
  const isLoggedIn = !!session?.user;

  return <ContactClient isLoggedIn={isLoggedIn} />;
}
