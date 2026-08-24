import { z } from 'zod';
import { ProductStatus, ReportCategory } from '@prisma/client';
import { isAllowedImageUrl, IMAGE_URL_ERROR } from './image-hosts';

/**
 * The categories the seller form offers. Kept here rather than only in the
 * <select> so the API cannot be handed a category no page will ever surface.
 * Adding one here is the only place it needs to change.
 */
export const PRODUCT_CATEGORIES = [
  'Fashion',
  'Electronics',
  'Beauty',
  'Home & Living',
  'Clay Crafts',
  'DIY Crafts',
  'Art & Collectibles',
  'Food & Beverages',
  'Other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Highest price a listing may carry, in rupees. Guards against 1e308 etc. */
export const MAX_PRICE = 10_000_000;

/**
 * Strict money parser. `parseFloat` is deliberately avoided: it turns "12abc"
 * into 12 and silently stores a value the seller never typed.
 */
const Money = (label: string) =>
  z.preprocess((val) => {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (trimmed === '') return undefined;
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return NaN;
    return Number(trimmed);
  }, z
    .number({ message: `${label} must be a number` })
    .finite(`${label} must be a number`)
    .min(0, `${label} must be 0 or greater`)
    .max(MAX_PRICE, `${label} cannot exceed ₹${MAX_PRICE.toLocaleString('en-IN')}`));

/** Only https URLs on hosts next/image is configured to render. */
const HostedImageUrl = z.string().refine(isAllowedImageUrl, IMAGE_URL_ERROR);

/** Text that must contain something after trimming, not just whitespace. */
const TrimmedText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} cannot exceed ${max} characters`)
    );

export const ShopSchema = z.object({
  name: TrimmedText(2, 100, 'Name'),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  logo: HostedImageUrl.or(z.string().length(0)).optional().nullable(),
  banner: HostedImageUrl.or(z.string().length(0)).optional().nullable(),
  whatsapp: z.preprocess(
    (val) => {
      if (typeof val !== 'string') return val;
      const clean = val.replace(/[^0-9+]/g, '');
      if (clean.length === 10 && /^[1-9]\d{9}$/.test(clean)) {
        return `+91${clean}`;
      }
      if (clean.length > 0 && !clean.startsWith('+')) {
        return `+${clean}`;
      }
      return clean;
    },
    z.string()
      .min(8, 'WhatsApp number must be at least 8 digits')
      .regex(/^\+?[1-9]\d{1,14}$/, 'WhatsApp number must be a valid international phone number without spaces or symbols')
  ),
  instagram: z.string().max(30).regex(/^[a-zA-Z0-9_.]+$/, 'Instagram handle must contain only letters, numbers, periods, and underscores').or(z.string().length(0)).optional().nullable(),
  telegram: z.string().max(32).regex(/^[a-zA-Z0-9_]+$/, 'Telegram username must contain only letters, numbers, and underscores').or(z.string().length(0)).optional().nullable(),
  city: z.string().max(80, 'City cannot exceed 80 characters').optional().nullable(),
  region: z.string().max(80, 'Region cannot exceed 80 characters').optional().nullable(),
  deliveryNote: z.string().max(200, 'Delivery note cannot exceed 200 characters').optional().nullable(),
  /**
   * Optimistic-concurrency token: the updatedAt the client last read. When
   * present, the write only lands if the row has not changed since.
   */
  expectedUpdatedAt: z.union([z.string(), z.date()]).optional().nullable(),
});

export const ProductImageSchema = z.object({
  url: HostedImageUrl,
  displayOrder: z.number().int().min(0, 'Image order cannot be negative').max(100).default(0),
  isPrimary: z.boolean().default(false),
});

export const MAX_PRODUCT_IMAGES = 12;

export const ProductSchema = z
  .object({
    title: TrimmedText(2, 200, 'Title'),
    description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),
    price: Money('Price'),
    compareAtPrice: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? null : val),
      Money('Compare-at price').nullable()
    ).optional(),
    category: z.enum(PRODUCT_CATEGORIES, {
      message: 'Choose one of the listed categories',
    }),
    options: z.string().max(200, 'Options cannot exceed 200 characters').optional().nullable(),
    inStock: z.boolean().optional().default(true),
    status: z.nativeEnum(ProductStatus).default(ProductStatus.ACTIVE),
    images: z
      .array(ProductImageSchema)
      .min(1, 'At least one product image is required')
      .max(MAX_PRODUCT_IMAGES, `Maximum ${MAX_PRODUCT_IMAGES} images per product`),
    /**
     * Optimistic-concurrency token: the updatedAt the client last read. When
     * present, the write only lands if the row has not changed since — so two
     * tabs editing the same product can no longer silently overwrite each
     * other.
     */
    expectedUpdatedAt: z.union([z.string(), z.date()]).optional().nullable(),
  })
  .refine(
    (p) => p.compareAtPrice == null || p.compareAtPrice > p.price,
    {
      message: 'Compare-at price must be higher than the selling price',
      path: ['compareAtPrice'],
    }
  );

export const ReviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  comment: TrimmedText(3, 1000, 'Comment'),
});

export const ReportSchema = z.object({
  /**
   * Defaulted rather than required so that an older client, or any existing
   * caller that only sends `reason`, still files a valid report instead of
   * failing validation — a complaint lost to a schema change is worse than a
   * complaint filed as OTHER.
   */
  category: z.nativeEnum(ReportCategory).default(ReportCategory.OTHER),
  reason: TrimmedText(5, 1000, 'Reason'),
});

export const ReorderImageItemSchema = z.object({
  id: z.string().min(1, 'Image ID is required'),
  displayOrder: z.number().int(),
  isPrimary: z.boolean(),
});

export const ReorderImagesSchema = z.array(ReorderImageItemSchema);
