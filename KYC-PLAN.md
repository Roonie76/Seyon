# Seller KYC — plan

Plan only. Nothing implemented. Companion to `ADMIN-DASHBOARD-PLAN.md`; the
review queue described here is a phase of that dashboard.

**I am not a lawyer and this is not legal advice.** It is a checklist to take to
one, written against what Seyon actually does. The specific claims about Aadhaar
and about what the e-commerce rules require should be confirmed by counsel before
you rely on them.

---

## 1. The product decision that comes first

**Do not gate store *creation* on KYC. Gate store *publishing*.**

Seyon's whole pitch is that an Instagram seller gets a storefront in minutes. A
document upload before they have seen the product working will destroy that. The
funnel you are trying to protect is exactly the funnel KYC-at-signup breaks.

The sequence that keeps both:

1. Sign up, create the store, add products — no KYC. Store exists but is
   unlisted: reachable by direct link, absent from the marketplace and search.
2. To publish — appear in discovery — complete Tier 0 (below). Minutes, no
   documents.
3. To earn the verified badge and higher limits — Tier 1. Documents, reviewed by
   a human.

The seller experiences the product before being asked for anything. You still get
identity before anything is publicly discoverable.

---

## 2. What Seyon is, legally, and why that matters

**No payment passes through Seyon.** Buyers pay sellers directly over WhatsApp.
That single fact removes the heaviest KYC obligations:

- Seyon is **not** a payment aggregator, so the RBI's PA/PG KYC directions do not
  apply. This is the rule set that would otherwise force full document KYC on
  every seller.
- Seyon does **not** collect TCS under GST, so it does not need every seller's
  GSTIN the way Amazon or Flipkart do.

What does apply:

- **Consumer Protection (E-Commerce) Rules, 2020.** A marketplace must obtain an
  undertaking from sellers that their descriptions are accurate, and must display
  each seller's legal name, principal geographic address, and customer-care
  contact. This is already open as item 0.6 in `LAUNCH-READINESS.md` — KYC is how
  it gets closed.
- **IT (Intermediary Guidelines) Rules, 2021.** Due diligence and a grievance
  officer. The grievance route is built and waiting for a name.
- **DPDP Act, 2023.** Everything you collect becomes your liability. Identity
  documents are the most sensitive thing Seyon would ever hold.

The practical conclusion: collect the minimum that satisfies the e-commerce rules
and lets you find a fraudulent seller, and no more.

---

## 3. Do not store Aadhaar

This is the single most important line in this document.

The Aadhaar Act restricts storing Aadhaar numbers, and storing scanned Aadhaar
copies in a general-purpose object store is a serious exposure — legally and
practically. A breach of a bucket containing thousands of Aadhaar images is a
different category of incident from a breach containing product photos.

**Use PAN instead.** It is the standard business identifier in India, it is
designed to be quoted, and it carries none of the Aadhaar restrictions.

If a seller has no PAN, accept a masked Aadhaar (last four digits visible only)
or another government ID, and store only:

- the document *type*
- the last four characters of the number
- a hash of the full number, for duplicate detection
- the document image, in a private bucket, deleted after review

Never the full Aadhaar number in a column.

---

## 4. Tiers

### Tier 0 — required to publish (minutes, no documents)

Almost entirely built already.

| Requirement | Status |
|---|---|
| Verified email | Exists (NextAuth) |
| WhatsApp number verified by OTP | **Already built** — `WhatsappVerification`, `requestWhatsappVerification`, `confirmWhatsappVerification`, `Shop.whatsappVerifiedAt`. Hashed codes, expiry, attempt counting. |
| Legal name of the seller or business | `User.sellerName` exists, not required |
| Principal geographic address | `User.addressLine1/2, city, state, postalCode, country` all exist, not required |
| Seller undertaking accepted | New — a checkbox with a timestamped record |

So Tier 0 is mostly a matter of **making existing fields required and recording
the undertaking**, not building new machinery.

### Tier 1 — required for the verified badge

| Field | Note |
|---|---|
| PAN number | validated by format, checksum, and uniqueness |
| ID document image | private bucket, admin-only, deleted after decision |
| Selfie or proof of possession | optional; decide whether it earns its keep |
| Business name, if different from legal name | |

Reviewed by a human in the admin dashboard. Approve, reject with a reason, or
request more.

### Tier 2 — only when applicable

GSTIN, collected and format-validated for sellers over the registration
threshold. Not a gate; a field, plus a nudge when their volume suggests they need
one.

---

## 5. `isVerified` currently means nothing

`Shop.isVerified` is an admin toggle with no criteria behind it, and the store
page shows a trust badge from it. Today that badge asserts something Seyon has
not checked.

Tier 1 is what gives it meaning. Until then, either define the criteria or soften
what the badge claims — a trust signal backed by nothing is worse than no badge,
because buyers act on it.

---

## 6. Storage — the landmine

**All three existing buckets are public**: `logos`, `banners`, `products`. They
have to be, they serve images to browsers. KYC documents must not go anywhere
near them.

Required:

- a new **private** bucket, `kyc-documents`, public = false
- access only through short-lived signed URLs generated server-side, after an
  `isCurrentUserAdmin()` check
- path prefixed by user id, reusing the `storagePrefixForUser` pattern already in
  `supabase.ts`
- **automatic deletion after a decision.** Keep the outcome and the audit row
  forever; keep the image only as long as review needs it. The document is the
  liability; the decision is the record.
- every access to a document written to the `AdminAction` audit log from the
  admin plan — who looked at whose ID, and when

---

## 7. Schema

```prisma
model SellerKyc {
  id             String     @id @default(cuid())
  userId         String     @unique
  tier           KycTier    @default(TIER_0)
  status         KycStatus  @default(NOT_STARTED)

  // Tier 0
  legalName      String?
  undertakingAt  DateTime?          // when the seller accepted the undertaking
  undertakingVersion String?        // which text they accepted

  // Tier 1 — minimum viable identity
  idType         KycIdType?         // PAN | PASSPORT | DL | VOTER_ID | AADHAAR_MASKED
  idLast4        String?            // never the full number
  idHash         String?            // sha256, for duplicate detection only
  documentPath   String?            // private bucket key; nulled after decision
  documentDeletedAt DateTime?

  // Tier 2
  gstin          String?

  reviewedById   String?
  reviewedAt     DateTime?
  rejectionReason String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  reviewer       User?     @relation("KycReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([status, createdAt])
  @@index([idHash])
}

enum KycTier   { TIER_0 TIER_1 TIER_2 }
enum KycStatus { NOT_STARTED PENDING_REVIEW APPROVED REJECTED EXPIRED }
enum KycIdType { PAN PASSPORT DRIVING_LICENCE VOTER_ID AADHAAR_MASKED }

model Shop {
  // + isListed  Boolean @default(false)   // Tier 0 complete = discoverable
}
```

`idHash` catches one seller opening five stores under five accounts with the same
PAN — the most likely fraud pattern on a platform like this, and cheap to detect.

`onDelete: Cascade` from `User` matters: the DPDP erasure flow already built in
`deleteMyAccount` must take KYC records with it.

---

## 8. Build order

| Phase | Work | Days |
|---|---|---|
| **K1** | `isListed` on Shop. Unlisted stores excluded from marketplace, search, sitemap, category pages. Direct link still works. | 0.5 |
| **K2** | Tier 0: require legal name and address, add the undertaking checkbox with a versioned timestamped record, wire the existing WhatsApp OTP as a publish gate. | 1 |
| **K3** | Display seller legal name, address, and contact on the storefront — this closes readiness item 0.6. | 0.5 |
| **K4** | Private `kyc-documents` bucket, signed-URL access, admin-only, audit every read. | 0.5 |
| **K5** | Tier 1 submission form, PAN validation, duplicate detection by `idHash`. | 1 |
| **K6** | Admin review queue: approve, reject with reason, request more. Slots into the admin dashboard as a phase. | 1 |
| **K7** | Document auto-deletion after decision, plus retention job. | 0.5 |
| **K8** | Tier 2 GSTIN field and threshold nudge. | 0.5 |
| | **Total** | **~5.5** |

K1 to K3 are the compliance-critical ones and involve no document handling at
all. If you ship nothing else, ship those: they satisfy the e-commerce rules and
carry almost no data-protection risk.

K4 to K7 are where the liability starts. Do not begin them until the private
bucket and the deletion job are both in place — collecting documents you cannot
safely store or delete is worse than not collecting them.

---

## 9. What I would not build

**Automated KYC via a third-party API** (Signzy, Karza, IDfy and similar). They
are the right answer at thousands of sellers a month. At your volume, manual
review in the admin dashboard is faster to build, cheaper, and produces better
judgement. Revisit when the queue is genuinely a bottleneck.

**Video KYC.** No obligation applies to Seyon that requires it.

**Blocking store creation.** Covered in section 1 — it is the single change most
likely to kill the funnel.

**Re-verification on a schedule.** Add `EXPIRED` to the enum so it is possible
later, but do not run it until there is a reason.
