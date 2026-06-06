import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-sync-secret');
    const expectedSecret = process.env.SYNC_WEBHOOK_SECRET;

    if (!expectedSecret || !authHeader || !safeCompare(authHeader, expectedSecret)) {
      return NextResponse.json({ error: 'Unauthorized. Invalid sync token.' }, { status: 401 });
    }

    const body = await request.json();
    const { action, type, data } = body;

    if (!action || !type || !data) {
      return NextResponse.json({ error: 'Missing required payload parameters.' }, { status: 400 });
    }

    if (type === 'SHOP') {
      if (action === 'DELETE') {
        await db.shop.delete({
          where: { id: data.id },
        });
        return NextResponse.json({ success: true, message: `Shop ${data.id} deleted successfully.` });
      }

      // For CREATE and UPDATE
      // Ensure owner user exists in the Buyer DB
      const ownerEmail = data.owner?.email || `seller-${data.ownerId}@seyon.app`;
      const ownerName = data.owner?.name || 'Seller';
      
      await db.user.upsert({
        where: { id: data.ownerId },
        create: {
          id: data.ownerId,
          name: ownerName,
          email: ownerEmail,
          role: 'SELLER',
        },
        update: {
          name: ownerName,
          email: ownerEmail,
        },
      });

      // Upsert the Shop record
      await db.shop.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          ownerId: data.ownerId,
          name: data.name,
          slug: data.slug,
          description: data.description,
          logo: data.logo,
          banner: data.banner,
          whatsapp: data.whatsapp,
          instagram: data.instagram,
          telegram: data.telegram,
          isVerified: data.isVerified,
          isSuspended: data.isSuspended,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        },
        update: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          logo: data.logo,
          banner: data.banner,
          whatsapp: data.whatsapp,
          instagram: data.instagram,
          telegram: data.telegram,
          isVerified: data.isVerified,
          isSuspended: data.isSuspended,
          updatedAt: new Date(data.updatedAt),
        },
      });

      return NextResponse.json({ success: true, message: `Shop ${data.id} synced successfully.` });
    }

    if (type === 'PRODUCT') {
      if (action === 'DELETE') {
        await db.product.delete({
          where: { id: data.id },
        });
        return NextResponse.json({ success: true, message: `Product ${data.id} deleted successfully.` });
      }

      // For CREATE and UPDATE
      // Upsert the Product record
      await db.product.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          shopId: data.shopId,
          title: data.title,
          slug: data.slug,
          description: data.description,
          price: data.price,
          category: data.category,
          status: data.status,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        },
        update: {
          shopId: data.shopId,
          title: data.title,
          slug: data.slug,
          description: data.description,
          price: data.price,
          category: data.category,
          status: data.status,
          updatedAt: new Date(data.updatedAt),
        },
      });

      // Sync product images if provided
      if (data.images && Array.isArray(data.images)) {
        const imageIds = data.images.map((img: any) => img.id).filter(Boolean);
        
        // Delete images not present in current payload
        await db.productImage.deleteMany({
          where: {
            productId: data.id,
            id: { notIn: imageIds },
          },
        });

        // Upsert updated/new images
        for (const img of data.images) {
          await db.productImage.upsert({
            where: { id: img.id },
            create: {
              id: img.id,
              productId: data.id,
              url: img.url,
              displayOrder: img.displayOrder,
              isPrimary: img.isPrimary,
            },
            update: {
              url: img.url,
              displayOrder: img.displayOrder,
              isPrimary: img.isPrimary,
            },
          });
        }
      }

      return NextResponse.json({ success: true, message: `Product ${data.id} synced successfully.` });
    }

    return NextResponse.json({ error: `Unknown type ${type}` }, { status: 400 });
  } catch (error: any) {
    console.error('Error handling product sync webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
