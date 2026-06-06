export async function triggerSync(action: 'CREATE' | 'UPDATE' | 'DELETE', type: 'SHOP' | 'PRODUCT', data: any) {
  try {
    const buyerUrl = process.env.BUYER_MARKET_URL || 'http://localhost:3000';
    const secret = process.env.SYNC_WEBHOOK_SECRET;

    if (!secret) {
      console.warn('Warning: SYNC_WEBHOOK_SECRET is not configured. Webhook sync skipped.');
      return;
    }

    const response = await fetch(`${buyerUrl}/api/webhooks/product-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': secret,
      },
      body: JSON.stringify({
        action,
        type,
        data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to trigger product sync webhook. Status: ${response.status}, Details: ${errorText}`);
    } else {
      const result = await response.json();
      console.log(`Successfully triggered product sync webhook. Action: ${action}, Type: ${type}, Result:`, result);
    }
  } catch (error) {
    console.error(`Error triggering product sync webhook. Action: ${action}, Type: ${type}, Details:`, error);
  }
}
