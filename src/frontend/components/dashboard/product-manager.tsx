'use client';

import * as React from 'react';
import { MAX_PRODUCT_IMAGES, MAX_PRODUCT_VARIANTS } from '@/shared/lib/zod-schemas';
import { SafeImage as NextImage } from '@/components/shared/safe-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStock,
  quickAddProducts,
  bulkSetProductStatus,
  bulkDeleteProducts,
  duplicateProduct,
} from '@/actions/products';
import { discardUpload } from '@/actions/uploads';
import { runAction } from '@/frontend/lib/run-action';
import { track } from '@/frontend/lib/events';
import { Product, ProductImage, ProductVariant, ProductStatus } from '@prisma/client';
import { Plus, Edit2, Trash2, Image as ImageIcon, Star, Upload, Loader2, PackageCheck, PackageX, MessageCircle, Zap, Share2, Check, Copy, X } from 'lucide-react';

interface ProductImageInput {
  url: string;
  isPrimary: boolean;
  displayOrder: number;
}

interface ProductWithImages extends Product {
  images: ProductImage[];
  variants: ProductVariant[];
}

/** A variant as the form holds it — prices are strings while being typed. */
interface VariantInput {
  name: string;
  priceDelta: string;
  inStock: boolean;
}

interface ProductManagerProps {
  shopId: string;
  shopSlug: string;
  products: ProductWithImages[];
  clickStats?: Record<string, { total: number; week: number; views: number }>;
}

export function ProductManager({ shopId, shopSlug, products, clickStats = {} }: ProductManagerProps) {
  const [quickAdding, setQuickAdding] = React.useState(false);

  /**
   * Which rows the seller has picked.
   *
   * A Set of ids rather than a flag on each product, so the selection survives
   * the list being re-fetched — after a bulk change the rows come back as new
   * objects, and a flag stored on them would be silently lost.
   */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState<string | null>(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = React.useState(false);
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);

  const visibleIds = React.useMemo(() => products.map((p) => p.id), [products]);
  const selectedVisible = React.useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected]
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function runBulkStatus(status: ProductStatus) {
    if (selectedVisible.length === 0 || bulkBusy) return;
    setBulkBusy(status);
    const res = await runAction(() =>
      bulkSetProductStatus(shopId, { productIds: selectedVisible, status })
    );
    setBulkBusy(null);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
      return;
    }
    // The server reports what it actually changed, which can be fewer than the
    // selection if a row was deleted in another tab meanwhile.
    setMessage({
      type: 'success',
      text: `${res.count} product${res.count === 1 ? '' : 's'} moved to ${status.toLowerCase()}.`,
    });
    setSelected(new Set());
    window.location.reload();
  }

  async function runBulkDelete() {
    if (selectedVisible.length === 0 || bulkBusy) return;
    setBulkBusy('delete');
    const res = await runAction(() => bulkDeleteProducts(shopId, selectedVisible));
    setBulkBusy(null);
    setConfirmingBulkDelete(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
      return;
    }
    setSelected(new Set());
    window.location.reload();
  }

  async function handleDuplicate(prod: ProductWithImages) {
    if (duplicatingId) return;
    setDuplicatingId(prod.id);
    const res = await runAction(() => duplicateProduct(prod.id));
    setDuplicatingId(null);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
      return;
    }
    window.location.reload();
  }

  const handleQuickAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (files.length > 12) {
      alert('Maximum 12 images per quick-add.');
      return;
    }

    setQuickAdding(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', 'products');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!data.url) throw new Error(data.error || 'Image upload failed');
        urls.push(data.url);
      }
      const result = await runAction(() => quickAddProducts(shopId, urls));
      if (result.error) {
        alert(result.error);
      } else {
        window.location.reload();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Quick-add failed');
    } finally {
      setQuickAdding(false);
    }
  };
  const [activeProduct, setActiveProduct] = React.useState<ProductWithImages | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<'add' | 'edit'>('add');
  const [isLoading, setIsLoading] = React.useState(false);
  /**
   * Latches once a save succeeds and stays true until the page reloads, so the
   * submit button cannot be pressed again during the 1.2s success window — that
   * gap used to turn one double-click into two identical products.
   */
  const [justSaved, setJustSaved] = React.useState(false);
  const [imageUploading, setImageUploading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = React.useState<{
    title: string;
    description: string;
    price: string;
    compareAtPrice: string;
    category: string;
    options: string;
    inStock: boolean;
    status: ProductStatus;
    images: ProductImageInput[];
    variants: VariantInput[];
    /** updatedAt of the row this dialog was opened on — the concurrency token. */
    expectedUpdatedAt: string | null;
  }>({
    title: '',
    description: '',
    price: '',
    compareAtPrice: '',
    category: '',
    options: '',
    inStock: true,
    status: ProductStatus.ACTIVE,
    images: [],
    variants: [],
    expectedUpdatedAt: null,
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      price: '',
      compareAtPrice: '',
      category: '',
      options: '',
      inStock: true,
      status: ProductStatus.ACTIVE,
      images: [],
      variants: [],
      expectedUpdatedAt: null,
    });
    setMessage(null);
    setActiveProduct(null);
    setJustSaved(false);
  };

  const openAdd = () => {
    resetForm();
    setDialogMode('add');
    setIsDialogOpen(true);
  };

  const openEdit = (product: ProductWithImages) => {
    setActiveProduct(product);
    setFormData({
      title: product.title,
      description: product.description || '',
      price: product.price.toString(),
      compareAtPrice: product.compareAtPrice != null ? product.compareAtPrice.toString() : '',
      category: product.category,
      options: product.options || '',
      inStock: product.inStock,
      status: product.status,
      images: product.images.map((img: ProductImage) => ({
        url: img.url,
        isPrimary: img.isPrimary,
        displayOrder: img.displayOrder,
      })),
      variants: (product.variants ?? []).map((v) => ({
        name: v.name,
        // Blank rather than "0" for no difference, so the common case reads as
        // empty instead of as a number the seller has to think about.
        priceDelta: v.priceDelta === 0 ? '' : String(v.priceDelta),
        inStock: v.inStock,
      })),
      expectedUpdatedAt: new Date(product.updatedAt).toISOString(),
    });
    setDialogMode('edit');
    setIsDialogOpen(true);
  };

  // Image Upload Action
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    /**
     * Check the cap before uploading, not after.
     *
     * Selecting twenty files uploaded all twenty — burning storage and the
     * whole hourly upload quota — and only then failed the save wholesale with
     * "Maximum 12 images per product", leaving twenty orphaned objects and
     * nothing saved.
     */
    const room = MAX_PRODUCT_IMAGES - formData.images.length;
    if (room <= 0) {
      setMessage({
        type: 'error',
        text: `This product already has the maximum of ${MAX_PRODUCT_IMAGES} images. Remove one to add another.`,
      });
      e.target.value = '';
      return;
    }
    const selected = Array.from(files).slice(0, room);
    const skipped = files.length - selected.length;

    setImageUploading(true);
    setMessage(null);

    const uploads = [];
    for (const file of selected) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'products');

      uploads.push(
        fetch('/api/upload', {
          method: 'POST',
          body: fd,
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.url) return data.url;
            throw new Error(data.error || 'Failed to upload image');
          })
      );
    }

    /**
     * `allSettled`, so one failure does not discard the successes.
     *
     * With `Promise.all`, a batch of six where the fourth failed threw away the
     * URLs of the other five — files already sitting in storage, now orphaned,
     * which the seller then re-uploaded.
     */
    const settled = await Promise.allSettled(uploads);
    const urls = settled
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value);
    const failures = settled.filter((r) => r.status === 'rejected').length;

    if (urls.length > 0) {
      setFormData((prev) => {
        const currentCount = prev.images.length;
        const newImages = urls.map((url, idx) => ({
          url,
          isPrimary: currentCount === 0 && idx === 0, // Set first image as primary
          displayOrder: currentCount + idx,
        }));
        return {
          ...prev,
          images: [...prev.images, ...newImages],
        };
      });
    }

    const notes: string[] = [];
    if (failures > 0) notes.push(`${failures} image${failures === 1 ? '' : 's'} failed to upload`);
    if (skipped > 0) {
      notes.push(
        `${skipped} skipped — a product can have ${MAX_PRODUCT_IMAGES} images at most`
      );
    }
    if (notes.length > 0) {
      setMessage({ type: 'error', text: `${notes.join('. ')}.` });
      if (failures > 0) track('upload_failed', { reason: `${failures} of ${selected.length}` });
    }

    setImageUploading(false);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const removed = formData.images[index];

    setFormData((prev) => {
      const filtered = prev.images.filter((_, idx) => idx !== index);
      // Re-assign display order and ensure one is primary if available
      const mapped = filtered.map((img, idx) => ({
        ...img,
        displayOrder: idx,
        isPrimary: img.isPrimary ? true : idx === 0 && !filtered.some((f) => f.isPrimary),
      }));
      return { ...prev, images: mapped };
    });

    /**
     * Delete the file too, not just the row in this form.
     *
     * Removing an image used to clear React state and nothing else, so the
     * object stayed in the bucket for good. The action refuses if any product
     * still references the URL — a duplicate listing sharing this photo, most
     * likely — so this is safe to fire without checking first.
     *
     * Deliberately not awaited and never surfaced: the seller asked to remove
     * an image from a form, and a storage failure is our problem, not a reason
     * to interrupt them mid-edit.
     */
    if (removed?.url) {
      void discardUpload(removed.url).catch(() => {
        /* best-effort; the nightly sweep is the backstop */
      });
    }
  };

  const setPrimaryImage = (index: number) => {
    setFormData((prev) => {
      const mapped = prev.images.map((img, idx) => ({
        ...img,
        isPrimary: idx === index,
      }));
      return { ...prev, images: mapped };
    });
  };

  // Submit Handler (Unified Add/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || justSaved) return;
    setIsLoading(true);
    setMessage(null);

    /**
     * Blank rows never reach the server.
     *
     * The variant editor always shows one empty row so there is somewhere to
     * type, and a seller who ignores it should not be told their product has an
     * invalid option. An empty name means "I did not use this row".
     */
    const payload = {
      ...formData,
      variants: formData.variants
        .filter((v) => v.name.trim().length > 0)
        .map((v) => ({
          name: v.name.trim(),
          priceDelta: v.priceDelta.trim() === '' ? 0 : Number(v.priceDelta),
          inStock: v.inStock,
        })),
    };

    const res = await runAction(() =>
      dialogMode === 'add'
        ? createProduct(shopId, payload)
        : activeProduct
        ? updateProduct(activeProduct.id, payload)
        : Promise.resolve({ error: 'No active product selected' })
    );

    if (res.error) {
      // Loading only clears on failure. On success the button stays disabled
      // until the reload, so the success window cannot be double-submitted.
      setIsLoading(false);
      setMessage({ type: 'error', text: res.error });
      track('product_create_failed', { mode: dialogMode, reason: res.error.slice(0, 80) });
      return;
    }

    track(dialogMode === 'add' ? 'product_created' : 'product_published', {
      category: formData.category,
      status: formData.status,
      imageCount: formData.images.length,
      hasDescription: formData.description.trim().length > 0,
      hasOptions: formData.options.trim().length > 0,
    });

    setJustSaved(true);
    setMessage({
      type: 'success',
      text: dialogMode === 'add' ? 'Product created successfully!' : 'Product updated successfully!',
    });
    setTimeout(() => {
      setIsDialogOpen(false);
      window.location.reload();
    }, 1200);
  };

  // Delete product action
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleDelete = async (productId: string) => {
    if (deletingId) return;
    /**
     * Offer the softer option, and say what deleting costs.
     *
     * `Analytics.productId` is `onDelete: SetNull` and the dashboard filters
     * those rows out, so deleting a listing silently destroys the buy taps and
     * views it earned. Archiving keeps them. Nothing said so, which made the
     * destructive choice the easy one.
     */
    if (
      !confirm(
        'Delete this product permanently?\n\n' +
          'Its views and WhatsApp taps go with it, and they cannot be recovered. ' +
          'Archiving instead takes it off your storefront and keeps the history — ' +
          'select it and choose Archive if that is what you want.'
      )
    )
      return;
    setDeletingId(productId);
    const res = await runAction(() => deleteProduct(productId));
    if (res.error) {
      setDeletingId(null);
      alert(res.error);
      return;
    }
    window.location.reload();
  };

  const [togglingStock, setTogglingStock] = React.useState<string | null>(null);

  const handleStockToggle = async (prod: ProductWithImages) => {
    if (togglingStock) return;
    setTogglingStock(prod.id);
    // Through `runAction` like every other mutation here — the ad-hoc catch it
    // replaced skipped `broadcastDataChanged()`, so marking an item sold out
    // was the one change that did not reach the seller's other open tabs.
    const res = await runAction(() => toggleProductStock(prod.id, !prod.inStock));
    if (res.error) {
      setTogglingStock(null);
      alert(res.error);
      return;
    }
    window.location.reload();
  };

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleShare = async (product: ProductWithImages) => {
    const shareUrl = `${window.location.origin}/store/${shopSlug}/${product.slug}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: `Check out ${product.title} on Seyon!`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        console.log('Web Share failed, falling back to clipboard copy:', err);
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(product.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      alert('Failed to copy link.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-foreground">All Products ({products.length})</h2>
        <div className="flex gap-2">
          <div className="relative">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleQuickAdd}
              disabled={quickAdding}
              title="Drop multiple photos — each becomes a draft product"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Button size="sm" variant="outline" className="gap-1" disabled={quickAdding}>
              {quickAdding ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Quick Add
            </Button>
          </div>
          <Button size="sm" className="gap-1" onClick={openAdd}>
            <Plus size={16} /> Add Product
          </Button>
        </div>
      </div>

      {/*
        The bulk bar, shown only when something is selected.

        Anchored above the table rather than floating, because it has to say
        how many rows it will act on and a floating bar that covers rows makes
        that number impossible to check.
      */}
      {selectedVisible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="text-xs font-bold text-amber-900">
            {selectedVisible.length} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 underline underline-offset-2"
          >
            <X size={11} /> Clear
          </button>

          <span className="mx-1 h-4 w-px bg-amber-300" aria-hidden="true" />

          {confirmingBulkDelete ? (
            <>
              <span className="text-xs font-bold text-red-800">
                Delete {selectedVisible.length} product{selectedVisible.length === 1 ? '' : 's'} for good?
              </span>
              <Button
                size="sm"
                variant="destructive"
                disabled={bulkBusy !== null}
                onClick={runBulkDelete}
                data-testid="bulk-delete-confirm"
              >
                {bulkBusy === 'delete' ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Trash2 size={13} className="mr-1" />}
                Yes, delete
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmingBulkDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              {/*
                Archive first and delete last, with the reversible options in
                between — the order the seller reads them in is the order of
                increasing consequence.
              */}
              <Button
                size="sm"
                variant="outline"
                disabled={bulkBusy !== null}
                onClick={() => runBulkStatus(ProductStatus.ACTIVE)}
                data-testid="bulk-publish"
              >
                {bulkBusy === ProductStatus.ACTIVE ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
                Publish
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkBusy !== null}
                onClick={() => runBulkStatus(ProductStatus.DRAFT)}
                data-testid="bulk-draft"
              >
                {bulkBusy === ProductStatus.DRAFT ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
                Move to draft
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkBusy !== null}
                onClick={() => runBulkStatus(ProductStatus.ARCHIVED)}
                data-testid="bulk-archive"
              >
                {bulkBusy === ProductStatus.ARCHIVED ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
                Archive
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={bulkBusy !== null}
                onClick={() => setConfirmingBulkDelete(true)}
                data-testid="bulk-delete"
              >
                <Trash2 size={13} className="mr-1" /> Delete
              </Button>
            </>
          )}
        </div>
      )}

      {/* Product List Table */}
      {products.length === 0 ? (
        <div className="p-16 border border-dashed border-zinc-200 rounded-xl text-center bg-card shadow-sm">
          <ImageIcon size={40} className="text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-foreground text-base">No products created</h3>
          <p className="text-xs text-muted-foreground mb-6">Create your first listing to showcase in your storefront catalog.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select every product on this page"
                  data-testid="select-all"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="h-4 w-4 cursor-pointer"
                />
              </TableHead>
              <TableHead>Listing</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead title="WhatsApp order taps">Buy taps</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((prod) => {
              const primaryImage = prod.images.find((i) => i.isPrimary) || prod.images[0];
              return (
                <TableRow key={prod.id} data-state={selected.has(prod.id) ? 'selected' : undefined}>
                  <TableCell className="w-8">
                    <input
                      type="checkbox"
                      aria-label={`Select ${prod.title}`}
                      checked={selected.has(prod.id)}
                      onChange={() => toggleRow(prod.id)}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-zinc-100 border border-zinc-200 rounded overflow-hidden shrink-0 flex items-center justify-center relative">
                        {primaryImage ? (
                          <NextImage src={primaryImage.url} alt={prod.title} width={40} height={40} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon size={16} className="text-muted-foreground/30" />
                        )}
                      </div>
                      <span className="font-bold text-foreground line-clamp-1">{prod.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{prod.category}</TableCell>
                  <TableCell className="font-semibold text-foreground">₹{prod.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={prod.status === 'ACTIVE' ? 'success' : prod.status === 'DRAFT' ? 'secondary' : 'destructive'}>
                      {prod.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleStockToggle(prod)}
                      disabled={togglingStock === prod.id}
                      title={prod.inStock ? 'Mark as sold out' : 'Mark as back in stock'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                        prod.inStock
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
                      }`}
                    >
                      {togglingStock === prod.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : prod.inStock ? (
                        <PackageCheck size={12} />
                      ) : (
                        <PackageX size={12} />
                      )}
                      {prod.inStock ? 'In stock' : 'Sold out'}
                    </button>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const stats = clickStats[prod.id];
                      if (!stats || (stats.total === 0 && stats.views === 0)) {
                        return <span className="text-xs text-muted-foreground/50">—</span>;
                      }
                      /*
                       * Views and taps together, plus the rate between them.
                       *
                       * A tap count alone cannot tell a seller whether a quiet
                       * listing is unseen or unconvincing, and those call for
                       * opposite fixes — better placement versus a better photo
                       * and price. `PRODUCT_VIEW` rows were already being
                       * written; nothing showed them.
                       *
                       * The rate is guarded rather than computed blindly: a
                       * listing with no views yet shows an em-dash, not NaN.
                       */
                      const rate =
                        stats.views > 0 ? Math.round((stats.total / stats.views) * 100) : null;
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground"
                            title={`${stats.total} WhatsApp taps all time`}
                          >
                            <MessageCircle size={12} className="text-emerald-600" />
                            {stats.week} <span className="text-muted-foreground font-normal">this week</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {stats.views} view{stats.views === 1 ? '' : 's'}
                            {rate !== null ? ` · ${rate}% tap` : ''}
                          </span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-emerald-650 transition-colors"
                        onClick={() => handleShare(prod)}
                        title="Copy product storefront link"
                      >
                        {copiedId === prod.id ? (
                          <Check size={14} className="text-emerald-600" />
                        ) : (
                          <Share2 size={14} />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-amber-600" onClick={() => openEdit(prod)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-sky-600"
                        title="Duplicate as a new draft"
                        aria-label={`Duplicate ${prod.title}`}
                        disabled={duplicatingId !== null}
                        onClick={() => handleDuplicate(prod)}
                      >
                        {duplicatingId === prod.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-600" onClick={() => handleDelete(prod.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Unified Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(val) => { setIsDialogOpen(val); if (!val) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'add' ? 'Add Product to Catalog' : 'Edit Product Details'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'add'
                ? 'Create a product listing in your storefront.'
                : 'Modify product listing details, status, and photos.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 my-2">
            {message && (
              <div className={`p-3 rounded-md text-sm font-semibold border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {message.text}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground/90">Product Title</label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Mechanical Keyboard"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground/90">Price (₹ INR)</label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1500"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground/90">Category</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>Select a category</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Beauty">Beauty</option>
                  <option value="Home & Living">Home & Living</option>
                  <option value="Clay Crafts">Clay Crafts</option>
                  <option value="DIY Crafts">DIY Crafts</option>
                  <option value="Art & Collectibles">Art & Collectibles</option>
                  <option value="Food & Beverages">Food & Beverages</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground/90">Listing Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as ProductStatus }))}
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={ProductStatus.ACTIVE}>Active (Public)</option>
                  <option value={ProductStatus.DRAFT}>Draft (Hidden)</option>
                  <option value={ProductStatus.ARCHIVED}>Archived</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground/90">Compare-at Price (optional)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Original price, shown struck through"
                  value={formData.compareAtPrice}
                  onChange={(e) => setFormData((prev) => ({ ...prev, compareAtPrice: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground/90">Options (optional)</label>
                <Input
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Sizes: S, M, L · Colors: Red, Black"
                  value={formData.options}
                  onChange={(e) => setFormData((prev) => ({ ...prev, options: e.target.value }))}
                />
                <span className="text-[11px] text-muted-foreground">
                  Choices that do not change the price — colour, wrapping. Buyers pick these and
                  they are included in their WhatsApp message.
                </span>
              </div>
            </div>

            {/*
              Priced options, separate from the free-text ones above.

              A size that costs more, or one that has sold out, is not the same
              kind of thing as a colour — it changes what the buyer is quoted
              and whether they can order at all. The free-text field could not
              express either, so a seller with a ₹200 difference between M and L
              had to either lose the difference or list two products.
            */}
            <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-foreground">Sizes &amp; priced options</p>
                  <p className="text-[11px] text-muted-foreground">
                    Leave empty if this product has one price. A difference of +200 means that
                    option costs ₹200 more than the price above.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={formData.variants.length >= MAX_PRODUCT_VARIANTS}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      variants: [...prev.variants, { name: '', priceDelta: '', inStock: true }],
                    }))
                  }
                  data-testid="variant-add"
                >
                  <Plus size={13} className="mr-1" /> Add option
                </Button>
              </div>

              {formData.variants.length === 0 ? (
                <p className="py-2 text-[11px] text-muted-foreground">
                  No priced options — buyers see one price for this product.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {formData.variants.map((variant, idx) => {
                    const base = Number(formData.price) || 0;
                    const delta = variant.priceDelta.trim() === '' ? 0 : Number(variant.priceDelta);
                    const total = base + delta;
                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <Input
                          value={variant.name}
                          maxLength={60}
                          placeholder="Medium"
                          aria-label={`Option ${idx + 1} name`}
                          data-testid={`variant-name-${idx}`}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              variants: prev.variants.map((v, i) =>
                                i === idx ? { ...v, name: e.target.value } : v
                              ),
                            }))
                          }
                          className="h-9 w-40"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="+0"
                          aria-label={`Option ${idx + 1} price difference`}
                          data-testid={`variant-delta-${idx}`}
                          value={variant.priceDelta}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              variants: prev.variants.map((v, i) =>
                                i === idx ? { ...v, priceDelta: e.target.value } : v
                              ),
                            }))
                          }
                          className="h-9 w-28"
                        />
                        {/* The number the buyer will actually be quoted, so the
                            seller never has to do the arithmetic themselves. */}
                        <span
                          className={`text-xs tabular-nums ${total <= 0 ? 'font-bold text-red-600' : 'text-muted-foreground'}`}
                        >
                          = ₹{total.toFixed(2)}
                        </span>
                        <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-semibold text-foreground/90">
                          <input
                            type="checkbox"
                            checked={variant.inStock}
                            data-testid={`variant-stock-${idx}`}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                variants: prev.variants.map((v, i) =>
                                  i === idx ? { ...v, inStock: e.target.checked } : v
                                ),
                              }))
                            }
                            className="h-3.5 w-3.5 accent-amber-500"
                          />
                          In stock
                        </label>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="ml-auto h-8 w-8 text-red-600 hover:bg-red-50"
                          aria-label={`Remove option ${idx + 1}`}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              variants: prev.variants.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-foreground/90 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.inStock}
                onChange={(e) => setFormData((prev) => ({ ...prev, inStock: e.target.checked }))}
                className="h-4 w-4 accent-amber-500"
              />
              In stock (uncheck to show as sold out)
            </label>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/90">Description</label>
              <Textarea
                rows={3}
                placeholder="Describe your product details, conditions, specs..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Images Manager */}
            <div className="border-t border-zinc-200 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground/90">Product Images ({formData.images.length})</span>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={imageUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={imageUploading}>
                    {imageUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload size={14} />} Upload Images
                  </Button>
                </div>
              </div>

              {formData.images.length === 0 ? (
                <div className="p-8 border border-dashed border-zinc-200 rounded-lg text-center text-muted-foreground text-xs">
                  Please upload at least one product image.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className={`relative rounded-md overflow-hidden bg-zinc-50 border-2 group aspect-square ${img.isPrimary ? 'border-amber-500 shadow-sm shadow-amber-500/10' : 'border-zinc-200'}`}>
                      <NextImage src={img.url} alt="product preview" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-10">
                        <button
                          type="button"
                          onClick={() => setPrimaryImage(idx)}
                          className="p-1.5 bg-amber-500 text-black rounded hover:scale-105"
                          title="Set Primary Cover"
                        >
                          <Star size={12} fill="currentColor" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="p-1.5 bg-crimson text-white rounded hover:scale-105"
                          title="Remove Image"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {img.isPrimary && (
                        <div className="absolute top-1 left-1 bg-amber-500 text-black text-[11px] font-extrabold px-1 rounded-sm z-10">
                          COVER
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={isLoading || justSaved || formData.images.length === 0}
                className="w-full"
              >
                {justSaved
                  ? (dialogMode === 'add' ? 'Product created' : 'Product saved')
                  : isLoading
                  ? (dialogMode === 'add' ? 'Creating Product...' : 'Saving Product...')
                  : (dialogMode === 'add' ? 'Deploy Listing' : 'Save Product Details')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
