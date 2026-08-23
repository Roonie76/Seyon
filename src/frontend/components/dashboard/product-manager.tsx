'use client';

import * as React from 'react';
import { SafeImage as NextImage } from '@/components/shared/safe-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { createProduct, updateProduct, deleteProduct, toggleProductStock, quickAddProducts } from '@/actions/products';
import { runAction } from '@/frontend/lib/run-action';
import { track } from '@/frontend/lib/events';
import { Product, ProductImage, ProductStatus } from '@prisma/client';
import { Plus, Edit2, Trash2, Image as ImageIcon, Star, Upload, Loader2, PackageCheck, PackageX, MessageCircle, Zap, Share2, Check } from 'lucide-react';

interface ProductImageInput {
  url: string;
  isPrimary: boolean;
  displayOrder: number;
}

interface ProductWithImages extends Product {
  images: ProductImage[];
}

interface ProductManagerProps {
  shopId: string;
  shopSlug: string;
  products: ProductWithImages[];
  clickStats?: Record<string, { total: number; week: number }>;
}

export function ProductManager({ shopId, shopSlug, products, clickStats = {} }: ProductManagerProps) {
  const [quickAdding, setQuickAdding] = React.useState(false);

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
      expectedUpdatedAt: new Date(product.updatedAt).toISOString(),
    });
    setDialogMode('edit');
    setIsDialogOpen(true);
  };

  // Image Upload Action
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImageUploading(true);
    setMessage(null);

    const uploads = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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

    try {
      const urls = await Promise.all(uploads);
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
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Error uploading files';
      setMessage({ type: 'error', text: errMessage });
      track('upload_failed', { reason: errMessage.slice(0, 80) });
    } finally {
      setImageUploading(false);
    }
  };

  const removeImage = (index: number) => {
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

    const res = await runAction(() =>
      dialogMode === 'add'
        ? createProduct(shopId, formData)
        : activeProduct
        ? updateProduct(activeProduct.id, formData)
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
    if (!confirm('Are you sure you want to delete this product? This action is permanent.')) return;
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
    const res = await toggleProductStock(prod.id, !prod.inStock).catch(() => ({
      error: "We couldn't reach Seyon. Check your connection and try again.",
    }));
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
                <TableRow key={prod.id}>
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
                      if (!stats || stats.total === 0) {
                        return <span className="text-xs text-muted-foreground/50">—</span>;
                      }
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground" title={`${stats.total} total WhatsApp taps`}>
                          <MessageCircle size={12} className="text-emerald-600" />
                          {stats.week} <span className="text-muted-foreground font-normal">this week</span>
                        </span>
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
                <span className="text-[10px] text-muted-foreground">Buyers pick these and they are included in their WhatsApp message.</span>
              </div>
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
                        <div className="absolute top-1 left-1 bg-amber-500 text-black text-[8px] font-extrabold px-1 rounded-sm z-10">
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
