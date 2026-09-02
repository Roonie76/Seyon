/**
 * A blog hub, as stored.
 *
 * Mirrors the `BlogTopic` row rather than re-declaring it, so a column added
 * in the schema cannot silently go missing from the type the pages render.
 */
import type { BlogTopic as PrismaBlogTopic } from '@prisma/client';

export type BlogTopic = PrismaBlogTopic;

/** What the admin form submits. `id` is absent when creating. */
export interface BlogTopicInput {
  slug: string;
  label: string;
  heading: string;
  seoTitle: string;
  description: string;
  intro: string[];
  tags: string[];
  sortOrder: number;
  published: boolean;
}
