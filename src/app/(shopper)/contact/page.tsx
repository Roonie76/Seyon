import * as React from 'react';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { ContactClient } from '@/components/help/ContactClient';

export const metadata: Metadata = {
  title: 'Contact Us | Seyon',
  description: 'Get in touch with the Seyon support team. Reach out to us via email — we typically respond within 24 hours.',
};

export default async function ContactPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return <ContactClient isLoggedIn={isLoggedIn} />;
}
