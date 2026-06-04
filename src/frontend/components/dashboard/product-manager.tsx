'use client';

import * as React from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { createProduct, updateProduct, deleteProduct } from '@/actions/products';
import { Product, ProductImage, ProductStatus } from '@prisma/client';
import { Plus, Edit2, Trash2, Image as ImageIcon, Star, Upload, Loader2 } from 'lucide-react';

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
  products: ProductWithImages[];
}

export function ProductManager({ shopId, products }: ProductManagerProps) {
  const [activeProduct, setActiveProduct] = React.useState<ProductWithImages | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<'add' | 'edit'>('add');
  const [isLoading, setIsLoading] = React.useState(false);
  const [imageUploading, setImageUploading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = React.useState<{
    title: string;
    description: string;
    price: string;
    category: string;
    status: ProductStatus;
    images: ProductImageInput[];
  }>({
    title: '',
    description: '',
    price: '',
    category: '',
    status: ProductStatus.ACTIVE,
    images: [],
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      price: '',
      category: '',
      status: ProductStatus.ACTIVE,
      images: [],
    });
    setMessage(null);
    setActiveProduct(null);
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
      category: product.category,
      status: product.status,
      images: product.images.map((img: ProductImage) => ({
        url: img.url,
        isPrimary: img.isPrimary,
        displayOrder: img.displayOrder,
      })),
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
    setIsLoading(true);
    setMessage(null);

    const res = dialogMode === 'add'
      ? await createProduct(shopId, formData)
      : activeProduct
      ? await updateProduct(activeProduct.id, formData)
      : { error: 'No active product selected' };

    setIsLoading(false);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({
        type: 'success',
        text: dialogMode === 'add' ? 'Product created successfully!' : 'Product updated successfully!',
      });
      setTimeout(() => {
        setIsDialogOpen(false);
        resetForm();
        window.location.reload();
      }, 1200);
    }
  };

  // Delete product action
  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action is permanent.')) return;
    const res = await deleteProduct(productId);
    if (res.error) {
      alert(res.error);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-foreground">All Products ({products.length})</h2>
        <Button size="sm" className="gap-1" onClick={openAdd}>
          <Plus size={16} /> Add Product
        </Button>
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
                  <TableCell className="font-semibold text-foreground">${prod.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={prod.status === 'ACTIVE' ? 'success' : prod.status === 'DRAFT' ? 'secondary' : 'destructive'}>
                      {prod.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
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
                <label className="text-xs font-semibold text-foreground/90">Price ($ USD)</label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  placeholder="e.g. 89.99"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground/90">Category</label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Electronics, Fashion"
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                />
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
                          className="p-1.5 bg-red-650 text-white rounded hover:scale-105"
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
              <Button type="submit" disabled={isLoading || formData.images.length === 0} className="w-full">
                {isLoading
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
