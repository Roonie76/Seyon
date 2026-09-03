import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { auth } from '@/lib/auth';
import { BlogTopicForm } from '@/components/admin/blog-topic-form';
import { publishedPostTags } from '@/backend/lib/blog-tags';

export const dynamic = 'force-dynamic';

export default async function NewBlogTopicPage() {
  const session = await auth();
  // The role is re-read from the database. The JWT claim it used to test was
  // writable by the client through the session-update endpoint, and is stale for
  // a revoked admin regardless.
  if (!session?.user || !(await isCurrentUserAdmin())) {
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
