import { redirect } from 'next/navigation';
import { getUserProfile } from '@/backend/actions/user-profile';
import { ProfileEditor } from '@/components/shared/profile-editor';

export const metadata = {
  title: 'My Account — Seller Portal | Seyon',
  description: 'Manage your seller profile, update your name, phone number, and profile picture on Seyon.',
};

export default async function SellerAccountPage() {
  const user = await getUserProfile('seller');

  if (!user) {
    redirect('/login?callbackUrl=/account');
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-secondary py-10 px-4 sm:px-6">
      <ProfileEditor user={user} type="seller" />
    </section>
  );
}
