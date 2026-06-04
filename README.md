# Seyon - Social Commerce Storefront Platform

Seyon is a highly optimized, high-performance social-commerce storefront platform where Instagram, WhatsApp, and Telegram sellers can create free storefronts, list products, and connect with buyers directly through WhatsApp. 

The platform does not process payments or manage logistics; instead, it acts as a premium storefront provider and discoverability engine (similar to Shopify storefront + Linktree + marketplace discovery).

## Key Features
- **Zero-Fee Storefront Creation**: Setup a catalog store in seconds.
- **WhatsApp Chat to Buy integration**: Prefilled order details directed to seller chats.
- **Dynamic Trust Score Rating**: Dynamic badges generated based on verifications and buyer reviews.
- **Full Text Discovery Engine**: High-performance category, product, and shop server-side search.
- **Moderation Panel**: Protects users against scams and abusive listings.
- **Deeply SEO Optimized**: Automatic Schema.org JSON-LD scripts, sitemaps, robots configurations, and meta headers.

---

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, custom glassmorphism.
- **Database**: PostgreSQL with Prisma ORM.
- **Authentication**: NextAuth / Auth.js (v5) supporting Google OAuth & email Credentials.
- **Image Storage**: Supabase Storage buckets.
- **Analytics**: PostHog tracking (client-side pageviews & server-side event captures).
- **Tests**: Vitest & JSDom.

---

## Directory Structure
```text
seyon/
├── prisma/
│   ├── schema.prisma       # Database design (User, Shop, Product, Reviews, Analytics)
│   └── seed.ts             # Seeding scripts for local testing data
├── src/
│   ├── app/                # App Router Layouts & Views
│   │   ├── admin/          # Admin moderation control dashboard
│   │   ├── api/            # API Route handlers (Auth handler, secure Supabase uploader)
│   │   ├── category/       # SEO landing department paths
│   │   ├── dashboard/      # Seller dashboard panels (shop setups, product tables)
│   │   ├── marketplace/    # Products discovery, keyword searches & category filters
│   │   └── store/          # Storefront and product details views with WhatsApp CTAs
│   ├── actions/            # Next.js Server Actions (Shops, Products, Reviews, Reports, Admin)
│   ├── components/         # Shared views and custom glass UI widgets
│   │   ├── admin/          # Admin moderation tables
│   │   ├── dashboard/      # Analytics chart widgets, onboarding forms
│   │   ├── shared/         # Navbar, Footer, Ratings, TrustScore badges, PostHog
│   │   ├── store/          # Image galleries, WhatsApp redirect buttons
│   │   └── ui/             # Curated design tokens (Buttons, Cards, Inputs, Dialogs)
│   ├── lib/                # Config singletons (Prisma client, NextAuth configuration, Supabase client)
│   └── types/              # Type extensions (next-auth overrides)
├── tests/                  # Test suites (Vitest action mocks, trust arithmetic checks)
├── Dockerfile              # Production stage container configs
├── docker-compose.yml      # Local DB compose files
└── vitest.config.ts        # Test configurations
```

---

## Installation & Setup

### 1. Clone & Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Create a `.env` file based on `.env.example`:
```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/seyon?schema=public"

# Auth
NEXTAUTH_SECRET="your_nextauth_secret_minimum_32_characters_long"
NEXTAUTH_URL="http://localhost:3000"

# Google Login API
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# Supabase Storage Bucket
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# PostHog API
NEXT_PUBLIC_POSTHOG_KEY="your-posthog-api-key"
```

### 3. Spin Up PostgreSQL and Migrate
If running docker locally:
```bash
# Start PostgreSQL Container
docker-compose up -d

# Run Prisma migrations
npx prisma db push

# Seed testing mock entries (Sellers, Products, Reviews)
npx prisma db seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the landing page!

---

## Testing & Quality Controls

We use Vitest to execute tests on actions, credentials, role restrictions, and trust score formulas:
```bash
# Execute Test Suite
npm run test
```

To run a static type analysis check:
```bash
npx tsc --noEmit
```

---

## Docker Deployment
To build and run Seyon inside a secure container:
```bash
# Build production image
docker build -t seyon-app .

# Start container mapped to port 3000
docker run -p 3000:3000 --env-file .env seyon-app
```
