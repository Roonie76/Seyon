import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQs',
  description: 'Answers to common questions about buying and selling on Seyon.',
  alternates: { canonical: '/help' },
};

export default function FAQsPage() {
  redirect('/help');
}
