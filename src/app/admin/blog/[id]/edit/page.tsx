import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { BlogForm } from '@/components/admin/blog-form';
import { getAllBlogTopics } from '@/backend/lib/blog-topics';
import { publishedPostCategories } from '@/backend/lib/blog-tags';

interface EditBlogPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: EditBlogPostPageProps) {
  const session = await auth();
  if (!session || !session.user || session.user.role !== Role.ADMIN) {
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
