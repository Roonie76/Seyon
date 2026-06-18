import { redirect } from 'next/navigation';
import { getUserProfile } from '@/backend/actions/user-profile';
import { ProfileEditor } from '@/components/shared/profile-editor';

export const metadata = {
  title: 'My Account | Seyon',
  description: 'Manage your profile, update your name, phone number, and profile picture on Seyon.',
};

export default async function ShopperAccountPage() {
  const user = await getUserProfile();

  if (!user) {
    redirect('/login?callbackUrl=/account');
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-secondary py-10 px-4 sm:px-6">
      <ProfileEditor user={user} />
    </section>
  );
}
