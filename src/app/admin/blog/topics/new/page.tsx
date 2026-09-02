import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { BlogTopicForm } from '@/components/admin/blog-topic-form';
import { publishedPostTags } from '@/backend/lib/blog-tags';

export const dynamic = 'force-dynamic';

export default async function NewBlogTopicPage() {
  const session = await auth();
  if (!session || !session.user || session.user.role !== Role.ADMIN) {
    redirect('/');
  }

  return (
    <section className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <BlogTopicForm availableTags={await publishedPostTags()} />
      </div>
    </section>
  );
}
