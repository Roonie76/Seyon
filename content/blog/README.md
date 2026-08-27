# Blog article sources

The markdown here is the source of truth for the seeded articles. It lives in
the repository rather than in a scratch directory for one reason: the tests in
`tests/blog-content.test.ts` run the real parser over these files, and a test
that silently skips because its fixtures are somewhere else protects nothing.

- `*.md` — one article body per published post, named by slug.
- `manifest.json` — per-post metadata (title, tags, cover, reading time, SEO
  fields) as generated alongside the seed SQL.

Editing a file here does **not** change the live post. The database is the
runtime source; these files are what the seed was built from and what the tests
check. A post edited through `/admin/blog` diverges from its file, which is
expected — the admin editor is for corrections, this directory is for the
articles the site launched with.
