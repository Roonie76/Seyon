/**
 * Seller hosts are configured explicitly via the SELLER_HOSTS env var
 * (comma-separated hostnames, no protocol, no port), e.g.:
 *   SELLER_HOSTS="sell.seyon.in,seyon-seller.vercel.app"
 */
function getSellerHosts(): Set<string> {
  const configured = process.env.SELLER_HOSTS || 'seyon-seller.vercel.app,localhost:3001,127.0.0.1:3000';
  return new Set(
    configured
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isSellerHost(host: string): boolean {
  if (!host) return false;
  const sellerHosts = getSellerHosts();
  const normalized = host.toLowerCase();
  const withoutPort = normalized.replace(/:\d+$/, '');
  return (
    sellerHosts.has(normalized) ||
    sellerHosts.has(withoutPort) ||
    withoutPort.startsWith('sell.') ||
    withoutPort.includes('seyon-seller')
  );
}
