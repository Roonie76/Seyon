'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: string;
  createdAt: Date;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/**
 * Fetch the authenticated user's profile from the database.
 */
export async function getUserProfile(type: 'shopper' | 'seller' = 'shopper'): Promise<UserProfile | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
      sellerName: true,
      sellerPhone: true,
      sellerImage: true,
      createdAt: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
    },
  });

  if (!user) return null;

  if (type === 'seller') {
    return {
      id: user.id,
      name: user.sellerName ?? user.name,
      email: user.email,
      phone: user.sellerPhone ?? user.phone,
      image: user.sellerImage ?? user.image,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
    addressLine1: user.addressLine1,
    addressLine2: user.addressLine2,
    city: user.city,
    state: user.state,
    postalCode: user.postalCode,
    country: user.country,
  };
}

/**
 * Update the authenticated user's profile (name, phone, image).
 * Email is read-only and cannot be changed.
 */
export async function updateUserProfile(
  type: 'shopper' | 'seller',
  data: {
    name?: string;
    phone?: string;
    image?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate name
  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (trimmed.length < 1) {
      return { success: false, error: 'Name cannot be empty' };
    }
    if (trimmed.length > 100) {
      return { success: false, error: 'Name must be 100 characters or less' };
    }
  }

  // Validate phone (optional, but if provided must be reasonable)
  if (data.phone !== undefined && data.phone.trim() !== '') {
    const phoneClean = data.phone.replace(/[\s\-\(\)]/g, '');
    if (!/^\+?\d{7,15}$/.test(phoneClean)) {
      return { success: false, error: 'Please enter a valid phone number' };
    }
  }

  try {
    const updateData = type === 'seller' ? {
      ...(data.name !== undefined && { sellerName: data.name.trim() }),
      ...(data.phone !== undefined && { sellerPhone: data.phone.trim() || null }),
      ...(data.image !== undefined && { sellerImage: data.image }),
    } : {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.phone !== undefined && { phone: data.phone.trim() || null }),
      ...(data.image !== undefined && { image: data.image }),
    };

    await db.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    revalidatePath('/shopper-account');
    revalidatePath('/seller-account');
    return { success: true };
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return { success: false, error: 'Failed to save changes. Please try again.' };
  }
}

export async function updateUserAddress(data: {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: {
        addressLine1: data.addressLine1?.trim() || null,
        addressLine2: data.addressLine2?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        country: data.country?.trim() || 'India',
      },
    });

    revalidatePath('/shopper-account');
    return { success: true };
  } catch (error) {
    console.error('Failed to update user address:', error);
    return { success: false, error: 'Failed to save address. Please try again.' };
  }
}
