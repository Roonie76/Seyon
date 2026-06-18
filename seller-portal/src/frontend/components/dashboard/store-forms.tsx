'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { createShop, updateShop, toggleShopPause, deleteShop } from '@/actions/shops';
import { confirmWhatsappVerification, requestWhatsappVerification } from '@/backend/actions/whatsapp';
import { Upload, HelpCircle, Loader2, PauseCircle, PlayCircle, MapPin, ShieldCheck, KeyRound, Trash2 } from 'lucide-react';

export function StoreOnboardingForm() {
  const [formData, setFormData] = React.useState({
    name: '',
    slug: '',
    description: '',
    logo: '',
    banner: '',
    whatsapp: '+91',
    instagram: '',
    telegram: '',
    city: '',
    region: '',
    deliveryNote: '',
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

          {/* Location & Delivery */}
          <div className="border-t border-zinc-200 pt-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground/90 flex items-center gap-1.5"><MapPin size={14} className="text-amber-600" /> Location & Delivery</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">City (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. Chennai"
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">State / Region (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. Tamil Nadu"
                  value={formData.region}
                  onChange={(e) => setFormData((prev) => ({ ...prev, region: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Delivery Note (Optional)</label>
              <Input
                type="text"
                maxLength={200}
                placeholder='e.g. "Ships across India" or "Pickup only, T. Nagar"'
                value={formData.deliveryNote}
                onChange={(e) => setFormData((prev) => ({ ...prev, deliveryNote: e.target.value }))}
              />
              <span className="text-[10px] text-muted-foreground">Shown to buyers next to the order button so they know if you deliver to them.</span>
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
              <span className="text-xs font-semibold text-foreground/80 uppercase">Shop Banner (Optional)</span>
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
  const router = useRouter();
  const [formData, setFormData] = React.useState({
    name: shop.name,
    slug: shop.slug,
    description: shop.description || '',
    logo: shop.logo || '',
    banner: shop.banner || '',
    whatsapp: shop.whatsapp,
    instagram: shop.instagram || '',
    telegram: shop.telegram || '',
    city: shop.city || '',
    region: shop.region || '',
    deliveryNote: shop.deliveryNote || '',
  });
  const [isPaused, setIsPaused] = React.useState(shop.isPaused);
  const [pauseLoading, setPauseLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleDeleteShop = async () => {
    const typed = window.prompt(
      `This permanently deletes "${shop.name}" with all products and reviews.\n\nType the store name to confirm:`
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== shop.name.trim().toLowerCase()) {
      setMessage({ type: 'error', text: 'Store name did not match. Deletion cancelled.' });
      return;
    }
    setDeleting(true);
    const res = await deleteShop();
    setDeleting(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      router.push('/sell');
    }
  };
  const [whatsappVerifiedAt, setWhatsappVerifiedAt] = React.useState(shop.whatsappVerifiedAt);
  const [verificationCode, setVerificationCode] = React.useState('');
  const [verificationLoading, setVerificationLoading] = React.useState<'request' | 'confirm' | null>(null);

  const handlePauseToggle = async () => {
    setPauseLoading(true);
    const res = await toggleShopPause(!isPaused);
    setPauseLoading(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setIsPaused(!isPaused);
      setMessage({ type: 'success', text: !isPaused ? 'Store paused. Buyers see "Currently away".' : 'Store reopened. Welcome back!' });
    }
  };

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
      setWhatsappVerifiedAt(res.shop?.whatsappVerifiedAt ?? null);
      setMessage({ type: 'success', text: 'Store configurations updated!' });
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  };

  const handleRequestVerification = async () => {
    setVerificationLoading('request');
    const res = await requestWhatsappVerification();
    setVerificationLoading(null);

    if (!('success' in res)) {
      setMessage({ type: 'error', text: res.error || 'Unable to send verification code' });
      return;
    }

    const target = res.delivery === 'whatsapp' ? 'WhatsApp' : res.delivery === 'email' ? 'email' : 'the dev response';
    setMessage({
      type: 'success',
      text: `Verification code sent via ${target}. It expires in 10 minutes.${res.devCode ? ` Dev code: ${res.devCode}` : ''}`,
    });
  };

  const handleConfirmVerification = async () => {
    setVerificationLoading('confirm');
    const res = await confirmWhatsappVerification(verificationCode);
    setVerificationLoading(null);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
      return;
    }

    setWhatsappVerifiedAt(new Date());
    setVerificationCode('');
    setMessage({ type: 'success', text: 'WhatsApp number verified.' });
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

          {/* Vacation mode */}
          <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${isPaused ? 'border-amber-500/40 bg-amber-500/10' : 'border-zinc-200 bg-zinc-50'}`}>
            <div className="flex items-start gap-3">
              {isPaused ? <PauseCircle className="h-5 w-5 text-amber-600 mt-0.5" /> : <PlayCircle className="h-5 w-5 text-emerald-600 mt-0.5" />}
              <div>
                <p className="text-sm font-bold text-foreground">{isPaused ? 'Store is paused (vacation mode)' : 'Store is open'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPaused
                    ? 'Buyers see "Currently away" and ordering is disabled. Your products are hidden from the marketplace.'
                    : 'Going away? Pause your store so buyers don\u2019t message you while you can\u2019t fulfil orders.'}
                </p>
              </div>
            </div>
            <Button type="button" variant={isPaused ? 'default' : 'outline'} size="sm" onClick={handlePauseToggle} disabled={pauseLoading} className="shrink-0">
              {pauseLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isPaused ? 'Reopen Store' : 'Pause Store'}
            </Button>
          </div>

          <div className={`rounded-xl border p-4 space-y-4 ${whatsappVerifiedAt ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-zinc-200 bg-zinc-50'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {whatsappVerifiedAt ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5" />
                ) : (
                  <KeyRound className="h-5 w-5 text-amber-600 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {whatsappVerifiedAt ? 'WhatsApp verified' : 'Verify WhatsApp number'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {whatsappVerifiedAt
                      ? `Verified for ${formData.whatsapp}. Changing the number requires re-verification.`
                      : 'Send a one-time code to prove buyers can reliably reach this seller contact.'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant={whatsappVerifiedAt ? 'outline' : 'default'}
                size="sm"
                onClick={handleRequestVerification}
                disabled={verificationLoading !== null}
                className="shrink-0"
              >
                {verificationLoading === 'request' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : whatsappVerifiedAt ? 'Reverify' : 'Send Code'}
              </Button>
            </div>

            {!whatsappVerifiedAt && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="sm:max-w-40"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleConfirmVerification}
                  disabled={verificationLoading !== null || verificationCode.length !== 6}
                >
                  {verificationLoading === 'confirm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm Code'}
                </Button>
              </div>
            )}
          </div>

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
                onChange={(e) => {
                  const whatsapp = e.target.value.replace(/[^0-9+]/g, '');
                  setFormData((prev) => ({ ...prev, whatsapp }));
                  if (whatsapp !== shop.whatsapp) {
                    setWhatsappVerifiedAt(null);
                  } else {
                    setWhatsappVerifiedAt(shop.whatsappVerifiedAt);
                  }
                }}
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

          {/* Location & Delivery */}
          <div className="border-t border-zinc-200 pt-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground/90 flex items-center gap-1.5"><MapPin size={14} className="text-amber-600" /> Location & Delivery</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">City</label>
                <Input
                  type="text"
                  placeholder="e.g. Chennai"
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">State / Region</label>
                <Input
                  type="text"
                  placeholder="e.g. Tamil Nadu"
                  value={formData.region}
                  onChange={(e) => setFormData((prev) => ({ ...prev, region: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Delivery Note</label>
                <Input
                  type="text"
                  maxLength={200}
                  placeholder='e.g. "Ships across India"'
                  value={formData.deliveryNote}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deliveryNote: e.target.value }))}
                />
              </div>
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
              <span className="text-xs font-semibold text-foreground/80 uppercase">Banner Preview (Optional)</span>
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

          {/* Danger zone */}
          <div className="border-t border-red-200 pt-6 mt-2">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                  <Trash2 className="h-4 w-4" /> Delete storefront
                </p>
                <p className="text-xs text-red-600/80 mt-1">
                  Permanently removes your store, all products, images, and reviews. This cannot be undone. You&apos;ll return to the seller landing page.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                className="shrink-0"
                onClick={handleDeleteShop}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Delete Store'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
