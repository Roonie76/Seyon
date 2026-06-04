'use client';

import * as React from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { createShop, updateShop } from '@/actions/shops';
import { Upload, HelpCircle, Loader2 } from 'lucide-react';

export function StoreOnboardingForm() {
  const [formData, setFormData] = React.useState({
    name: '',
    slug: '',
    description: '',
    logo: '',
    banner: '',
    whatsapp: '',
    instagram: '',
    telegram: '',
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState<'logo' | 'banner' | null>(null);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(field);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('bucket', field === 'logo' ? 'logos' : 'banners');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.url) {
        setFormData((prev) => ({ ...prev, [field]: data.url }));
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to upload image' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload connection failed' });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const res = await createShop(formData);
    setIsLoading(false);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Store successfully created! Redirecting...' });
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
    setFormData((prev) => ({ ...prev, name, slug }));
  };

  return (
    <Card className="max-w-2xl mx-auto border-zinc-200 shadow-sm bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-foreground">
          Create Your Storefront
        </CardTitle>
        <CardDescription>
          Provide your store brand details and link your chat socials. Zero setup fees, instant deployment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div className={`p-4 rounded-md text-sm font-semibold border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-755 border-emerald-200' : 'bg-red-50 text-red-755 border-red-200'}`}>
              {message.text}
            </div>
          )}

          {/* Core Info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/80 uppercase">Shop Name</label>
              <Input
                required
                type="text"
                placeholder="e.g. Gadget Central"
                value={formData.name}
                onChange={handleNameChange}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/80 uppercase flex items-center gap-1">
                Store URL Handle <span className="text-muted-foreground cursor-help" title="Custom slug: /store/your-slug"><HelpCircle size={12} /></span>
              </label>
              <Input
                required
                type="text"
                placeholder="e.g. gadget-central"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '') }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/80 uppercase">Description</label>
            <Textarea
              rows={3}
              placeholder="Tell buyers what you sell, what your delivery speeds are, and store rules..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Socials & Contacts */}
          <div className="border-t border-zinc-200 pt-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground/90">Contacts & Channels</h3>
            
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-emerald-650 uppercase">WhatsApp Number</label>
                <Input
                  required
                  type="tel"
                  placeholder="e.g. +15551234567 (with country code)"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData((prev) => ({ ...prev, whatsapp: e.target.value.replace(/[^0-9+]/g, '') }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Instagram (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. gadgetcentral_ig"
                  value={formData.instagram}
                  onChange={(e) => setFormData((prev) => ({ ...prev, instagram: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Telegram (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. gadgetcentral_tg"
                  value={formData.telegram}
                  onChange={(e) => setFormData((prev) => ({ ...prev, telegram: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Images Uploads */}
          <div className="border-t border-zinc-200 pt-6 grid sm:grid-cols-2 gap-6">
            {/* Logo */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground/80 uppercase">Shop Logo</span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center relative shrink-0">
                  {formData.logo ? (
                    <NextImage src={formData.logo} alt="Logo" width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <Upload size={20} className="text-muted-foreground/35" />
                  )}
                </div>
                <div className="flex-grow relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, 'logo')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading !== null}
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" disabled={uploading !== null}>
                    {uploading === 'logo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Logo
                  </Button>
                </div>
              </div>
            </div>

            {/* Banner */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground/80 uppercase">Shop Banner</span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-32 rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center relative shrink-0">
                  {formData.banner ? (
                    <NextImage src={formData.banner} alt="Banner" width={128} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <Upload size={20} className="text-muted-foreground/35" />
                  )}
                </div>
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, 'banner')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading !== null}
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" disabled={uploading !== null}>
                    {uploading === 'banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Banner
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full mt-4">
            {isLoading ? 'Creating Storefront...' : 'Deploy Shop Catalog'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { Shop } from '@prisma/client';

export function StoreSettingsForm({ shop }: { shop: Shop }) {
  const [formData, setFormData] = React.useState({
    name: shop.name,
    slug: shop.slug,
    description: shop.description || '',
    logo: shop.logo || '',
    banner: shop.banner || '',
    whatsapp: shop.whatsapp,
    instagram: shop.instagram || '',
    telegram: shop.telegram || '',
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState<'logo' | 'banner' | null>(null);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(field);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('bucket', field === 'logo' ? 'logos' : 'banners');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.url) {
        setFormData((prev) => ({ ...prev, [field]: data.url }));
        setMessage({ type: 'success', text: `${field} uploaded successfully. Save settings to apply.` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to upload image' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload connection failed' });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const res = await updateShop(shop.id, formData);
    setIsLoading(false);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Store configurations updated!' });
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  };

  return (
    <Card className="border-zinc-200 shadow-sm bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-foreground">Storefront Profile</CardTitle>
        <CardDescription>Modify your storefront catalog and linked contact details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div className={`p-4 rounded-md text-sm font-semibold border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/80 uppercase">Shop Name</label>
              <Input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/80 uppercase">Store Handle</label>
              <Input
                required
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '') }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/80 uppercase">Description</label>
            <Textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="border-t border-zinc-200 pt-6 grid sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-emerald-650 uppercase">WhatsApp Number</label>
              <Input
                required
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => setFormData((prev) => ({ ...prev, whatsapp: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Instagram Handle</label>
              <Input
                type="text"
                value={formData.instagram}
                onChange={(e) => setFormData((prev) => ({ ...prev, instagram: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Telegram Handle</label>
              <Input
                type="text"
                value={formData.telegram}
                onChange={(e) => setFormData((prev) => ({ ...prev, telegram: e.target.value }))}
              />
            </div>
          </div>

          {/* Logo & Banner Editor */}
          <div className="border-t border-zinc-200 pt-6 grid sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground/80 uppercase">Logo Preview</span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                  {formData.logo ? (
                    <NextImage src={formData.logo} alt="Logo" width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <Upload size={20} className="text-muted-foreground/35" />
                  )}
                </div>
                <div className="flex-grow relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, 'logo')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading !== null}
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" disabled={uploading !== null}>
                    {uploading === 'logo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Logo
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground/80 uppercase">Banner Preview</span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-28 rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                  {formData.banner ? (
                    <NextImage src={formData.banner} alt="Banner" width={112} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <Upload size={20} className="text-muted-foreground/35" />
                  )}
                </div>
                <div className="flex-grow relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, 'banner')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading !== null}
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" disabled={uploading !== null}>
                    {uploading === 'banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Banner
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Saving Configurations...' : 'Save Profile Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
