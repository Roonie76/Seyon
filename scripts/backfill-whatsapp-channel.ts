/**
 * Stamps `whatsappVerifiedVia` on shops verified before the column existed.
 *
 * Discovery now requires `whatsappVerifiedVia = WHATSAPP`, because a code read
 * out of the seller's own inbox proves they can read their inbox, not that they
 * hold the number they typed. Rows verified before that distinction existed
 * carry a timestamp and no channel, and would drop out of the marketplace on
 * the deploy that adds the rule — an outage for every listed store.
 *
 * So they are treated as WHATSAPP. That is an assertion we cannot actually
 * prove, and it is the right call anyway: we have no evidence either way, and
 * silently unlisting every existing seller is a much worse error than
 * grandfathering a verification we already accepted. New verifications record
 * their real channel, so this is a one-time amnesty, not a policy.
 *
 * Against the current production database this is a no-op — there are no shops
 * in it yet. It matters for local and staging data.
 *
 *   npx tsx scripts/backfill-whatsapp-channel.ts
 *
 * Idempotent: only touches rows where the column is still null.
 */
import 'dotenv/config';
import { PrismaClient, WhatsappVerifiedVia } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  console.log(`backfilling whatsappVerifiedVia on ${new URL(url).host}`);

  const pool = new pg.Pool({ connectionString: url });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const res = await db.shop.updateMany({
    where: { whatsappVerifiedAt: { not: null }, whatsappVerifiedVia: null },
    data: { whatsappVerifiedVia: WhatsappVerifiedVia.WHATSAPP },
  });

  console.log(`${res.count} shop${res.count === 1 ? '' : 's'} grandfathered`);

  const stranded = await db.shop.count({
    where: { isListed: true, whatsappVerifiedVia: null },
  });
  if (stranded > 0) {
    console.warn(
      `WARNING: ${stranded} listed shop(s) still have no verification channel and will not ` +
        `appear in discovery. They were listed without a verified number, which the new rule ` +
        `refuses. They need to verify before they are visible again.`
    );
  }

  await db.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
