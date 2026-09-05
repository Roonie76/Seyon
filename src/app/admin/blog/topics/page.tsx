import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import Link from 'next/link';
import { getSession } from '@/backend/lib/session';
import { getAllBlogTopics } from '@/backend/lib/blog-topics';
import { blogTopicPostCounts } from '@/backend/actions/blog-topics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, LayoutGrid } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * The hubs behind /blog/topic/*.
 *
 * These were five objects in a TypeScript file, so every wording change was a
 * deploy and a post tagged with something no hub listed belonged nowhere at
 * all. The post count on each row is the thing worth watching: a hub matching
 * nothing is still in the sitemap, and an empty page in a sitemap is the
 * shape of thin content search engines drop first.
 */
export default async function AdminBlogTopicsPage() {
  const session = await getSession();
  // The role is re-read from the database. The JWT claim it used to test was
  // writable by the client through the session-update endpoint, and is stale for
  // a revoked admin regardless.
  if (!session?.user || !(await isCurrentUserAdmin())) {
    redirect('/');
  }

  const [topics, counts] = await Promise.all([getAllBlogTopics(), blogTopicPostCounts()]);

  return (
    <section className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-950">Blog hubs</h1>
            <p className="text-sm text-zinc-600">
              The topic pages at /blog/topic/*. Tags decide which posts appear under each one.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/blog">Posts</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/blog/topics/new">
                <Plus className="mr-1.5 h-4 w-4" /> New hub
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4" /> {topics.length} hub{topics.length === 1 ? '' : 's'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topics.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-600">
                No hubs yet. Without at least one, /blog has no topic navigation and no hub
                pages for search engines to land on.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Hub</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Posts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topics.map((topic) => {
                    const count = counts[topic.id] ?? 0;
                    return (
                      <TableRow key={topic.id}>
                        <TableCell className="text-zinc-500">{topic.sortOrder}</TableCell>
                        <TableCell>
                          <span className="font-bold text-zinc-950">{topic.label}</span>
                          <span className="block text-[11px] text-zinc-500">
                            /blog/topic/{topic.slug}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[16rem]">
                          <span className="text-[11px] font-semibold uppercase text-zinc-600">
                            {topic.tags.length ? topic.tags.join(', ') : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {count === 0 ? (
                            <Badge variant="destructive">empty</Badge>
                          ) : (
                            <span className="font-semibold">{count}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {topic.published ? (
                            <Badge>live</Badge>
                          ) : (
                            <Badge variant="secondary">hidden</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/blog/topics/${topic.id}/edit`}>
                              <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
