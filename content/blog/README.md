# Blog content

**The database is the source of truth.** Posts and topic hubs are created and
edited at `/admin/blog` and `/admin/blog/topics`; nothing in this directory is
read at build time or at runtime.

## `archive/`

The thirty markdown files that seeded the blog in August 2026, plus the
`manifest.json` that described them and the ten retired seller-facing posts.
They are kept because they are the original drafts and because they record what
was published before anyone edited it — not because anything reads them.

They were *also* a second copy of every post, which is why they are no longer
where the loader would look for them: the moment an editor changed a headline
in the admin screen, the file said one thing and the site said another, with
nothing to reconcile them and no error to notice.

Do not restore them to `content/blog/` and do not add new ones. To change what
is published, use the admin screens.

## Checking the live blog

`npm run blog:doctor` reads whatever `DATABASE_URL` points at and reports
articles that are too short, links to posts that do not exist, covers the
policy rejects, hubs matching no post, headings out of order, and any block
marker the parser left in the text. It is read-only, so it can be pointed at
production.
