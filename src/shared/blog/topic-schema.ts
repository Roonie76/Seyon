import { z } from 'zod';

/**
 * What a blog hub is allowed to be.
 *
 * These rules used to be assertions in a test file, checking five objects that
 * only a developer could change. Now that an editor creates hubs from the
 * admin screen, the same rules have to run at the moment of writing: a test
 * cannot stop somebody saving a hub with a 90-character title.
 *
 * It lives here rather than beside the server action because a `'use server'`
 * module may only export async functions — a plain constant exported from one
 * makes the whole module fail to load, with an error that names the wrong
 * thing. Keeping it separate also lets the tests exercise the rules without
 * dragging in the database and the auth stack.
 */

/** The root layout appends " | Seyon", and search results truncate near 60. */
export const MAX_TOPIC_SEO_TITLE = 52;
/** Meta descriptions are cut off around here. */
export const MAX_TOPIC_DESCRIPTION = 200;

export const BlogTopicInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'A URL slug is required')
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'The slug becomes /blog/topic/<slug>, so it may only contain lowercase letters, numbers and single hyphens'
    ),
  label: z.string().trim().min(1, 'A short label is required'),
  heading: z.string().trim().min(1, 'A page heading is required'),
  seoTitle: z
    .string()
    .trim()
    .min(1, 'An SEO title is required')
    .max(
      MAX_TOPIC_SEO_TITLE,
      `The layout appends " | Seyon", so a title over ${MAX_TOPIC_SEO_TITLE} characters is cut off mid-word in search results — and the brand is the part that gets cut`
    ),
  description: z
    .string()
    .trim()
    .min(1, 'A description is required')
    .max(
      MAX_TOPIC_DESCRIPTION,
      `Descriptions over ${MAX_TOPIC_DESCRIPTION} characters are truncated in search results`
    ),
  /**
   * A hub whose only content is a list of links is a thin page, and thin hub
   * pages are what search engines drop first. At least one paragraph of its
   * own is the floor; the five original hubs were written with two.
   */
  intro: z
    .array(z.string().trim().min(1))
    .min(1, 'A hub needs at least one paragraph of its own, or it is a page of nothing but links'),
  /**
   * Normalised to upper case and de-duplicated. Posts store their tags that
   * way, and matching is case-insensitive regardless — doing it here keeps the
   * two lists legible side by side in the editor.
   */
  tags: z
    .array(z.string().trim().min(1))
    .transform((tags) => Array.from(new Set(tags.map((t) => t.toUpperCase())))),
  // Messages written out, because this one reaches an editor. Left to Zod's
  // defaults it surfaced as "Too big: expected number to be <=999", which is
  // the only message in this form that reads like a stack trace.
  sortOrder: z
    .number()
    .int('Sort order must be a whole number')
    .min(0, 'Sort order cannot be negative')
    .max(999, 'Sort order must be 999 or less'),
  published: z.boolean(),
});

export type BlogTopicInput = z.infer<typeof BlogTopicInputSchema>;
