import { z } from 'zod';
import { ProductStatus } from '@prisma/client';

export const ShopSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  logo: z.string().url('Invalid logo URL').or(z.string().length(0)).optional().nullable(),
  banner: z.string().url('Invalid banner URL').or(z.string().length(0)).optional().nullable(),
  whatsapp: z.string()
    .min(8, 'WhatsApp number must be at least 8 digits')
    .regex(/^\+?[1-9]\d{1,14}$/, 'WhatsApp number must be a valid international phone number without spaces or symbols'),
  instagram: z.string().max(30).regex(/^[a-zA-Z0-9_.]+$/, 'Instagram handle must contain only letters, numbers, periods, and underscores').or(z.string().length(0)).optional().nullable(),
  telegram: z.string().max(32).regex(/^[a-zA-Z0-9_]+$/, 'Telegram username must contain only letters, numbers, and underscores').or(z.string().length(0)).optional().nullable(),
  city: z.string().max(80, 'City cannot exceed 80 characters').optional().nullable(),
  region: z.string().max(80, 'Region cannot exceed 80 characters').optional().nullable(),
  deliveryNote: z.string().max(200, 'Delivery note cannot exceed 200 characters').optional().nullable(),
});

export const ProductImageSchema = z.object({
  url: z.string().url('Invalid image URL'),
  displayOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export const ProductSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),
  price: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(0, 'Price must be 0 or greater')
  ),
  compareAtPrice: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return null;
      return typeof val === 'string' ? parseFloat(val) : val;
    },
    z.number().min(0, 'Compare-at price must be 0 or greater').nullable()
  ).optional(),
  category: z.string().min(1, 'Category is required'),
  options: z.string().max(200, 'Options cannot exceed 200 characters').optional().nullable(),
  inStock: z.boolean().optional().default(true),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.ACTIVE),
  images: z.array(ProductImageSchema).min(1, 'At least one product image is required'),
});

export const ReviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  comment: z.string().min(3, 'Comment must be at least 3 characters').max(1000, 'Comment cannot exceed 1000 characters'),
});

export const ReportSchema = z.object({
  reason: z.string().min(5, 'Report reason must be at least 5 characters').max(1000, 'Reason cannot exceed 1000 characters'),
});

export const ReorderImageItemSchema = z.object({
  id: z.string().min(1, 'Image ID is required'),
  displayOrder: z.number().int(),
  isPrimary: z.boolean(),
});

export const ReorderImagesSchema = z.array(ReorderImageItemSchema);

