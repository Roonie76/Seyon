import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { getBlogPosts, deleteBlogPost } from '@/backend/actions/blog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, FileText } from 'lucide-react';
import { DeletePostButton } from '@/components/admin/delete-post-button';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  const session = await auth();
  if (!session || !session.user || session.user.role !== Role.ADMIN) {
    redirect('/');
  }

  const result = await getBlogPosts({ publishedOnly: false });
  const posts = result.success && result.posts ? result.posts : [];

  // Delete Action Handler for Server-Side submission
  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (id) {
      await deleteBlogPost(id);
      revalidatePath('/admin/blog');
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            ← Back to Moderation Panel
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-2">
            <FileText size={28} className="text-primary" /> Blog Articles Manager
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Publish brand stories, high-end guides, and product announcements directly to the visitor blog.
          </p>
        </div>

        <Link href="/admin/blog/new">
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus size={16} /> Write Article
          </Button>
        </Link>
      </div>

      {/* Main Table Card */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">
            All Blog Stories ({posts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {posts.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-4">
              <div className="inline-flex h-12 w-12 bg-primary/10 border border-primary/20 rounded-full items-center justify-center text-primary">
                <FileText size={24} />
              </div>
              <h3 className="text-sm font-bold text-foreground">No Articles Published</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Begin creating your luxury blog presence by writing your very first story.
              </p>
              <Link href="/admin/blog/new">
                <Button variant="outline" className="text-xs gap-1.5">
                  <Plus size={14} /> Write First Article
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cover</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Featured</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id} className="hover:bg-zinc-950/40">
                      <TableCell>
                        <div className="h-10 w-16 rounded border border-border overflow-hidden bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.cover}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold max-w-[200px] truncate">
                        {post.title}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{post.category}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {post.author}
                      </TableCell>
                      <TableCell>
                        {post.published ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px]">
                            Published
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-[11px]">
                            Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {post.featured ? (
                          <Badge className="bg-primary/10 text-primary border border-primary/20 text-[11px]">
                            Hero Post
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(post.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Link href={`/admin/blog/${post.id}/edit`}>
                            <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                              <Edit size={14} />
                            </Button>
                          </Link>

                          <DeletePostButton
                            id={post.id}
                            title={post.title}
                            action={handleDelete}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
