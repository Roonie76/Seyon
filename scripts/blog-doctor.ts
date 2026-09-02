/**
 * Checks every published article, against the database.
 *
 * These checks used to be a vitest file reading `content/blog/*.md`. That was
 * fine while the markdown was the source of truth, and became misleading the
 * moment editing moved to the admin screen: a test reading files could not see
 * a post somebody had just written, and would keep reporting a clean corpus
 * while the live blog rotted.
 *
 * So they run against whatever database `DATABASE_URL` points at, which means
 * they can be pointed at production. Read-only, and safe to run any time.
 *
 *   npm run blog:doctor
 *
 * Exits non-zero when something is wrong, so CI can gate a deploy on it.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { parseBlocks, wordCount } from '../src/shared/blog/parse';
import { inlineToPlainText } from '../src/shared/blog/inline';
import { checkCoverUrl } from '../src/shared/blog/cover';

/** Below this an article is unlikely to rank for anything it targets. */
const MIN_WORDS = 600;

interface Problem {
  slug: string;
  detail: string;
}

const problems: Problem[] = [];
const warnings: Problem[] = [];
const fail = (slug: string, detail: string) => problems.push({ slug, detail });
const warn = (slug: string, detail: string) => warnings.push({ slug, detail });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const posts = await db.blogPost.findMany({
    where: { published: true },
    orderBy: { slug: 'asc' },
  });
  const topics = await db.blogTopic.findMany({ where: { published: true } });
  const liveSlugs = new Set(posts.map((p) => p.slug));

  console.log(`checking ${posts.length} published posts against ${topics.length} hubs\n`);

  if (posts.length === 0) fail('—', 'no published posts at all');

  let internalLinks = 0;

  for (const post of posts) {
    const cover = checkCoverUrl(post.cover);
    if (!cover.ok) fail(post.slug, `cover rejected: ${cover.reason}`);

    const words = wordCount(post.content);
    if (words < MIN_WORDS) fail(post.slug, `only ${words} words, under the ${MIN_WORDS} floor`);

    let blocks;
    try {
      blocks = parseBlocks(post.content);
    } catch (error) {
      fail(post.slug, `content does not parse: ${(error as Error).message}`);
      continue;
    }
    if (blocks.length === 0) {
      fail(post.slug, 'content parses to nothing');
      continue;
    }

    // An article that opens on a heading duplicates its own <h1>.
    if (blocks[0].kind === 'h2' || blocks[0].kind === 'h3') {
      fail(post.slug, 'opens with a heading rather than a paragraph');
    }

    // h3 before any h2 is a broken outline, which assistive technology reads
    // as a skipped level.
    const firstH2 = blocks.findIndex((b) => b.kind === 'h2');
    const firstH3 = blocks.findIndex((b) => b.kind === 'h3');
    if (firstH3 !== -1 && (firstH2 === -1 || firstH3 < firstH2)) {
      fail(post.slug, 'uses an h3 before any h2');
    }

    // Markers the parser did not consume are rendered to the reader verbatim.
    for (const block of blocks) {
      if (block.kind !== 'paragraph') continue;
      const text = inlineToPlainText(block.inline);
      if (/\[[a-z-]+:[^\]]*\]/i.test(text)) {
        fail(post.slug, `unconsumed block marker in text: ${text.slice(0, 60)}`);
      }
    }

    // Internal links must point at something that exists. An unpublished post
    // is a 404, not merely unlisted, so linking to one is a broken link.
    for (const [, href] of post.content.matchAll(/\]\((\/blog\/[^)#?]+)\)/g)) {
      internalLinks += 1;
      const target = href.split('/').filter(Boolean).pop()!;
      if (href.startsWith('/blog/topic/')) {
        if (!topics.some((t) => t.slug === target)) {
          fail(post.slug, `links to /blog/topic/${target}, which is not a published hub`);
        }
      } else if (!liveSlugs.has(target)) {
        fail(post.slug, `links to /blog/${target}, which is not a published post`);
      }
    }

    // A post in no hub is reachable only from the index.
    const wanted = new Set(post.tags.map((t) => t.trim().toUpperCase()));
    const inAHub = topics.some((t) => t.tags.some((tag) => wanted.has(tag.trim().toUpperCase())));
    if (!inAHub) warn(post.slug, 'matches no hub, so only the index links to it');
  }

  // Guards the guard: if the links were ever stripped, the check above would
  // pass while protecting nothing.
  if (posts.length > 5 && internalLinks < 5) {
    warn('—', `only ${internalLinks} internal links across ${posts.length} posts`);
  }

  for (const topic of topics) {
    const count = posts.filter((p) => {
      const wanted = new Set(topic.tags.map((t) => t.toUpperCase()));
      return p.tags.some((tag) => wanted.has(tag.toUpperCase()));
    }).length;
    if (count === 0) {
      fail(topic.slug, 'hub is published and matches no post — an empty page in the sitemap');
    }
  }

  const featured = posts.filter((p) => p.featured);
  if (featured.length === 0) warn('—', 'no featured post, so the index has no hero');
  if (featured.length > 1) {
    fail('—', `${featured.length} posts marked featured: ${featured.map((p) => p.slug).join(', ')}`);
  }

  await db.$disconnect();
  await pool.end();

  for (const w of warnings) console.log(`  warn  ${w.slug}: ${w.detail}`);
  for (const p of problems) console.log(`  FAIL  ${p.slug}: ${p.detail}`);

  console.log(
    `\n${problems.length} problem${problems.length === 1 ? '' : 's'}, ` +
      `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
  );
  process.exit(problems.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
