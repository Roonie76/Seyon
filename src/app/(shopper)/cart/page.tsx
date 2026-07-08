import type { Metadata } from 'next';
import { CartClient } from './cart-client';

export const metadata: Metadata = {
  title: 'My Shopping Basket',
  description:
    'Review your selected items from local shops, verify current prices and availability, and place orders directly with creators over WhatsApp.',
};

export default function CartPage() {
  return <CartClient />;
}
