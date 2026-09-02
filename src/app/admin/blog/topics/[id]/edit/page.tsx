import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { BlogTopicForm } from '@/components/admin/blog-topic-form';
import { getBlogTopicById } from '@/backend/lib/blog-topics';
import { blogTopicPostCounts } from '@/backend/actions/blog-topics';
import { publishedPostTags } from '@/backend/lib/blog-tags';
import { DeleteTopicButton } from '@/components/admin/delete-topic-button';

export const dynamic = 'force-dynamic';

interface EditTopicPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogTopicPage({ params }: EditTopicPageProps) {
  const session = await auth();
  if (!session || !session.user || session.user.role !== Role.ADMIN) {
    redirect('/');
  }

  const { id } = await params;
  const topic = await getBlogTopicById(id);
  if (!topic) notFound();

  const [tags, counts] = await Promise.all([publishedPostTags(), blogTopicPostCounts()]);

  return (
    <section className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <BlogTopicForm
          initialTopic={topic}
          availableTags={tags}
          matchedCount={counts[topic.id] ?? 0}
        />
        <DeleteTopicButton id={topic.id} label={topic.label} slug={topic.slug} />
      </div>
    </section>
  );
}
