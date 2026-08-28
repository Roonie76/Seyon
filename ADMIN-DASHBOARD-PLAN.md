# Admin dashboard — plan

Plan only. Nothing implemented. Written after reading the admin code that already
exists, so the phases below build on it rather than duplicating it.

---

## 1. What you already have

More than you might think. `/admin` is live and gated by `isCurrentUserAdmin()`,
which re-reads the role from the database rather than trusting the JWT claim —
that is the right check and it is already correct.

| Capability | Where | State |
|---|---|---|
| Admin gate | `src/backend/lib/is-admin.ts` | Solid |
| Dashboard stats | `getAdminDashboardStats()` | Works |
| Reports list + resolve | `resolveReportAction`, `AdminModeration` | Basic but working |
| Verify / unverify store | `verifyShopAction` | Works |
| Suspend / unsuspend store | `suspendShopAction` | Works |
| Delete a product | `deleteProductAction` | Works |
| Change a user's role | `updateUserRoleAction` | Works, **but see 3.1** |
| Blog CRUD | `/admin/blog/*` | Works |
| Email sending | `notify()` via Resend | Exists, unused by admin |

So of the five things you asked for, **complaints and part of access control are
already built**. The genuinely missing pieces are reviews, search, notices,
store deletion, and "under review" as a real state.

---

## 2. Gaps against what you asked for

**Store reviews — nothing exists.** No admin view, no moderation, no way to
remove a review. The `Review` model has no `isHidden` column and no report
mechanism, so a defamatory or spam review can only be removed by deleting the
row, which silently changes the shop's rating with no record of why.

**Complaints — thin.** `Report.reason` is a free-text string with no category,
no admin notes, no record of who resolved it or why, and no timestamps beyond
`createdAt`. You cannot answer "did we acknowledge this within 48 hours",
which the Consumer Protection (E-Commerce) Rules 2020 require you to be able to
answer.

**"Under review" for a store — does not exist.** `Shop` has `isVerified`,
`isSuspended`, `isPaused`. `ReportStatus.UNDER_REVIEW` describes the *report*,
not the store. There is no state meaning "still trading, but we are looking at
them". This is a product decision before it is a schema one: does a store under
review stay fully visible, lose its verified badge, or show a notice to buyers?

**Send a notice — no mechanism.** `notify()` can send email, but nothing records
that a notice was sent, what it said, or whether the seller saw it. A notice you
cannot prove you sent is not much use in a dispute.

**Delete a store — admin cannot.** `deleteShop()` in `shops.ts` is the seller
deleting their own; it takes no arguments and works off the session. There is no
admin equivalent.

**Search — none.** `getAdminDashboardStats()` loads **every** store into the
page. Fine at 10 stores. At a few thousand it is a slow page; at ten thousand it
is a dead one. There is no search by store name, no owner lookup, no pagination.

---

## 3. Problems in the admin code as it stands

These are worth fixing before building on top.

### 3.1 Any admin can promote anyone to admin, silently

`updateUserRoleAction` validates the id and the role, checks the caller is an
admin, and then writes. It does not prevent:

- promoting an arbitrary user to `ADMIN`
- demoting another admin
- demoting yourself — which, with one admin account, locks everyone out permanently

Combined with no audit log, one compromised admin session creates a second admin
account that nobody will ever notice. This is the most serious thing in the
current admin surface.

### 3.2 No audit log

Suspending a store takes away a seller's livelihood. Deleting a product destroys
their work. Right now none of it is recorded: not who did it, not when, not why.
When a seller says "you suspended me unfairly", you have nothing. This is the
single highest-value addition on this whole list, and it is also the cheapest.

### 3.3 No rate limits on admin actions

`RATE_LIMITS` has no admin entries. A stolen admin session can suspend every
store in the marketplace as fast as the network allows.

### 3.4 Destructive actions use `confirm()`

`AdminModeration` gates suspend behind a browser `confirm()`. Fine for a toggle
that reverses; not enough for deletion. Deleting a store should require typing
its slug, the way account deletion requires typing the email.

---

## 4. Schema changes

Everything below is additive. No column is dropped, so migrations are safe to
apply while the site is running.

```prisma
// 4.1 — the audit log. Build this first; everything else references it.
model AdminAction {
  id           String   @id @default(cuid())
  actorId      String              // the admin who did it
  action       String              // SUSPEND_SHOP, DELETE_PRODUCT, GRANT_ADMIN, ...
  targetType   String              // Shop | Product | Review | User | Report
  targetId     String
  reason       String?             // required in the UI for destructive actions
  metadata     Json?               // before/after values
  createdAt    DateTime @default(now())

  actor        User     @relation(fields: [actorId], references: [id], onDelete: Restrict)

  @@index([targetType, targetId, createdAt])
  @@index([actorId, createdAt])
}

// 4.2 — review moderation. Hide rather than delete, so ratings stay explicable.
model Review {
  // + isHidden    Boolean  @default(false)
  // + hiddenAt    DateTime?
  // + hiddenById  String?
  // + hiddenReason String?
}

// 4.3 — complaints worth the name
model Report {
  // + category        ReportCategory @default(OTHER)
  // + adminNotes      String?
  // + resolvedById    String?
  // + resolvedAt      DateTime?
  // + acknowledgedAt  DateTime?      // proves the 48-hour window
}

enum ReportCategory {
  COUNTERFEIT
  MISLEADING_LISTING
  NON_DELIVERY
  ABUSIVE_CONDUCT
  PROHIBITED_ITEM
  OTHER
}

// 4.4 — store under review, as a real state
model Shop {
  // + isUnderReview     Boolean  @default(false)
  // + underReviewSince  DateTime?
  // + underReviewReason String?
}

// 4.5 — notices, recorded rather than just sent
model Notice {
  id         String     @id @default(cuid())
  shopId     String
  issuedById String
  severity   NoticeSeverity   // INFO | WARNING | FINAL_WARNING
  subject    String
  body       String
  emailSent  Boolean  @default(false)
  readAt     DateTime?          // set when the seller opens it in their dashboard
  createdAt  DateTime @default(now())

  shop       Shop     @relation(fields: [shopId], references: [id], onDelete: Cascade)
  issuedBy   User     @relation(fields: [issuedById], references: [id], onDelete: Restrict)

  @@index([shopId, createdAt])
}

enum NoticeSeverity { INFO WARNING FINAL_WARNING }

// 4.6 — access control with more than one level
enum Role {
  USER
  SELLER
  SUPPORT      // new: read + respond to complaints, issue INFO notices. No deletion.
  ADMIN        // everything except granting ADMIN
  OWNER        // new: the only role that can grant or revoke ADMIN
}
```

Note `onDelete: Restrict` on the audit and notice actor relations. An admin who
acted cannot later be deleted in a way that erases the record of what they did.

---

## 5. Build order

Each phase ships on its own and leaves the product working.

### Phase 1 — make the existing admin safe (half a day)

Do this before adding features, because everything after it inherits these
properties.

1. `AdminAction` model plus a `recordAdminAction()` helper.
2. Wrap every existing admin action so it writes an audit row: verify, suspend,
   delete product, change role.
3. Fix `updateUserRoleAction`: forbid self-demotion, forbid demoting the last
   remaining admin, and gate granting `ADMIN` behind the new `OWNER` role.
4. Add `RATE_LIMITS.ADMIN_ACTION` — generous, but bounded.
5. Require a typed `reason` for suspend and delete; store it on the audit row.

**Test:** an integration test asserting that suspending a store writes exactly
one audit row naming the actor, and that an admin cannot demote themselves.

### Phase 2 — search and pagination (half a day)

`getAdminDashboardStats()` stops returning `allStores`. Replace with a dedicated
`searchStores({ query, status, page })`:

- match on store name, slug, owner email, owner name, WhatsApp number
- `pg_trgm` is already installed, so `ILIKE` search is indexed — reuse the
  pattern from `src/backend/lib/search.ts`
- return owner details inline: name, email, phone, joined date, product count,
  review count, average rating, open report count, current states
- paginate through the existing `parsePage` helper in `shared/lib/search-params.ts`

This alone fixes the "store by name then full owner details" requirement, and it
removes the page's current habit of loading the entire store table.

### Phase 3 — store detail page (one day)

`/admin/stores/[slug]` — one screen with everything about a store:

- owner identity and contact
- product list with per-product delete
- reviews with hide/unhide
- reports against this store, with history
- notices sent, and whether they were read
- the audit trail for this store, newest first
- actions: verify, put under review, suspend, delete

Deletion requires typing the store slug. Suspension and review require a reason.

### Phase 4 — reviews moderation (half a day)

- `isHidden` on `Review`; hidden reviews excluded from display and from
  `recomputeShopRating()`
- admin list of recent and reported reviews
- hide/unhide writes an audit row with a reason

Hide rather than delete, so the rating change is always explicable.

### Phase 5 — complaints workflow (one day)

- category on the report form (buyer-facing) and filters on the admin list
- acknowledge action, stamping `acknowledgedAt` — this is what proves the
  48-hour window
- admin notes and a resolution note, both audited
- a queue view sorted by age, with anything past 48 hours unacknowledged or 30
  days unresolved marked overdue

### Phase 6 — notices (one day)

- compose a notice against a store, pick severity, send
- persist to `Notice`, then send by email through the existing `notify()`
- seller dashboard shows unread notices and stamps `readAt` when opened
- a `FINAL_WARNING` surfaces on the store's admin page as a flag

### Phase 7 — access control UI (half a day)

- user list with search and role filter
- role changes respecting the Phase 1 rules
- an admin activity view: the audit log, filterable by actor, target and date

---

## 6. Deliberately not in this plan

**Deleting a store from admin — with a caveat.** Phase 3 includes it because you
asked, but suspension is almost always the better answer: it is instant,
reversible, and preserves the evidence if the seller disputes it. My
recommendation is that deletion requires a store to have been suspended first,
and that the audit row survives the deletion.

**A separate admin app or subdomain.** The two-host split you already have is
enough. A third deployment triples the config surface for no security gain that
the role check does not already provide.

**Granular per-permission roles.** Four roles cover what a marketplace this size
needs. Permission matrices are a lot of machinery for a team of one.

**Bulk actions.** Bulk suspend is the operation most likely to be catastrophic by
accident, and least likely to be needed before you have thousands of stores.

---

## 7. Estimate

| Phase | Work |
|---|---|
| 1 — safety and audit | 0.5 day |
| 2 — search | 0.5 day |
| 3 — store detail | 1 day |
| 4 — reviews | 0.5 day |
| 5 — complaints | 1 day |
| 6 — notices | 1 day |
| 7 — access control UI | 0.5 day |
| **Total** | **~5 days** |

Phases 1 and 2 are the ones I would not ship the MVP without. Phase 1 because an
unaudited admin panel that can silently mint admins is a liability, and Phase 2
because the current page stops working as soon as the marketplace succeeds.
