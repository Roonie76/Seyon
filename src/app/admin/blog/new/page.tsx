import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { BlogForm } from '@/components/admin/blog-form';

export default async function NewBlogPostPage() {
  const session = await auth();
  if (!session || !session.user || session.user.role !== Role.ADMIN) {
    redirect('/');
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <BlogForm />
    </div>
  );
}
