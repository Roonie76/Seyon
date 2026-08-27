# Blog article sources

The markdown here is the source of truth for the seeded articles. It lives in
the repository rather than in a scratch directory for one reason: the tests in
`tests/blog-content.test.ts` run the real parser over these files, and a test
that silently skips because its fixtures are somewhere else protects nothing.

- `*.md` — one article body per published post, named by slug.
- `manifest.json` — per-post metadata (title, tags, cover, reading time, SEO
  fields) as generated alongside the seed SQL.
- `retired/` — sources for posts that are `published = false` in the database.
  Kept, not deleted: unpublishing is one boolean and so is undoing it. The
  tests glob `*.md` at this level only, so a retired article is not checked
  for links into the live set — it may well link to something no longer
  published, which is exactly why it is not in the live set.

Editing a file here does **not** change the live post. The database is the
runtime source; these files are what the seed was built from and what the tests
check. A post edited through `/admin/blog` diverges from its file, which is
expected — the admin editor is for corrections, this directory is for the
articles the site launched with.

## What is retired, and why

The blog opened with thirteen guides written for sellers — selling on
Instagram, pricing, shipping, GST, buyer trust. They are good and they are
unpublished, because they brought the wrong side of a two-sided marketplace:
a blog that ranks for "how to price handmade products" attracts people who
want to sell, and Seyon's traffic problem is people who want to buy.

Their covers remain in `public/blog` so that republishing any of them is a
single change to one column.
