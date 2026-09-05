import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getSession } from '@/backend/lib/session';
import { BlogForm } from '@/components/admin/blog-form';
import { getAllBlogTopics } from '@/backend/lib/blog-topics';
import { publishedPostCategories } from '@/backend/lib/blog-tags';

export default async function NewBlogPostPage() {
  const session = await getSession();
  // The role is re-read from the database. The JWT claim it used to test was
  // writable by the client through the session-update endpoint, and is stale for
  // a revoked admin regardless.
  if (!session?.user || !(await isCurrentUserAdmin())) {
    redirect('/');
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <BlogForm topics={await getAllBlogTopics()} categories={await publishedPostCategories()} />
    </div>
  );
}
