import { redirect, notFound } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getSession } from '@/backend/lib/session';
import { db } from '@/lib/db';
import { BlogForm } from '@/components/admin/blog-form';
import { getAllBlogTopics } from '@/backend/lib/blog-topics';
import { publishedPostCategories } from '@/backend/lib/blog-tags';

interface EditBlogPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: EditBlogPostPageProps) {
  const session = await getSession();
  // The role is re-read from the database. The JWT claim it used to test was
  // writable by the client through the session-update endpoint, and is stale for
  // a revoked admin regardless.
  if (!session?.user || !(await isCurrentUserAdmin())) {
    redirect('/');
  }

  const { id } = await params;

  const post = await db.blogPost.findUnique({
    where: { id },
  });

  if (!post) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <BlogForm
        initialPost={post}
        topics={await getAllBlogTopics()}
        categories={await publishedPostCategories()}
      />
    </div>
  );
}
