'use client';

import * as React from 'react';
import type { SellerShopView } from '@/backend/lib/seller-shop-view';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { createShop, updateShop, toggleShopPause, deleteShop } from '@/actions/shops';
import { runAction } from '@/frontend/lib/run-action';
import { track } from '@/frontend/lib/events';
import { asciiSlug } from '@/shared/lib/slugify';
import { confirmWhatsappVerification, requestWhatsappVerification } from '@/backend/actions/whatsapp';
import { Upload, HelpCircle, Loader2, PauseCircle, PlayCircle, MapPin, ShieldCheck, KeyRound, Trash2 } from 'lucide-react';
import { DeliveryOffersRow } from '@/components/shared/delivery-offers';

/**
 * The form is delivered disabled, and enables itself once React owns it.
 *
 * The dashboard streams, so these inputs exist in the HTML well before the
 * client component mounts. A seller who started typing in that window lost
 * everything: React resets an input's value on hydration, the form then
 * submitted blank, and the browser's own required-field warning swallowed it.
 * The seller saw a form that did nothing — no store, no error, nothing to
 * report to support.
 *
 * Making the fields uncontrolled does not fix it. That was the first attempt
 * and it passed once on a warm cache, which is worse than failing: React
 * resets an uncontrolled input to its `defaultValue` on hydration just the
 * same, so the data is lost either way.
 *
 * What does fix it is refusing the input rather than dropping it. The fieldset
 * is disabled in the server-rendered HTML and enabled by an effect that can
 * only run after mount, so there is no window in which a keystroke can be
 * accepted and then discarded. The cost is a moment where the form is visibly
 * not ready, which is honest, and the button says so.
 *
 * The fields stay uncontrolled regardless, because the payload is then read
 * from the form element at submit time and there is no second copy of the
 * seller's answers to fall out of step with what they can see.
 */
export function StoreOnboardingForm() {
  const formRef = React.useRef<HTMLFormElement>(null);
  const slugRef = React.useRef<HTMLInputElement>(null);
  /** Set once the seller edits the handle, so we stop overwriting their choice. */
  const slugTouched = React.useRef(false);

  /**
   * False on the server, true once React has mounted.
   *
   * `useSyncExternalStore` rather than an effect that calls setState: the two
   * snapshots ARE the server/client distinction, so there is no render in
   * which the flag is wrong, and no effect for the lint rule about cascading
   * renders to object to. The store never emits, because nothing external
   * changes — mounting is the only event.
   */
  const ready = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [images, setImages] = React.useState({ logo: '', banner: '' });
  const [deliveryPreview, setDeliveryPreview] = React.useState('');
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
        setImages((prev) => ({ ...prev, [field]: data.url }));
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to upload image' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload connection failed' });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setMessage(null);

    // Read from the form itself. This is the whole point: the DOM holds what
    // the seller typed, whether or not React was mounted when they typed it.
    const fd = new FormData(e.currentTarget);
    const text = (key: string) => String(fd.get(key) ?? '').trim();

    const payload = {
      name: text('name'),
      slug: text('slug'),
      description: text('description'),
      logo: images.logo,
      banner: images.banner,
      whatsapp: text('whatsapp'),
      instagram: text('instagram'),
      telegram: text('telegram'),
      city: text('city'),
      region: text('region'),
      deliveryNote: text('deliveryNote'),
    };

    const res = await runAction(() => createShop(payload));

    if (res.error) {
      setIsLoading(false);
      setMessage({ type: 'error', text: res.error });
      return;
    }

    track('shop_created', { hasLogo: Boolean(payload.logo), city: payload.city || null });

    // Stays disabled through the redirect so the form cannot be submitted twice.
    setMessage({ type: 'success', text: 'Store successfully created! Redirecting...' });
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (slugTouched.current || !slugRef.current) return;
    // Store handles are ASCII-only (ShopSchema). A name written in another
    // script yields an empty suggestion; the seller then picks their own
    // handle rather than being handed "" or "-".
    slugRef.current.value = asciiSlug(e.target.value);
  };

  return (
    <Card className="max-w-2xl mx-auto border-zinc-200 shadow-sm bg-card text-card-foreground">
      <CardHeader className="space-y-2">
        <CardTitle className="text-3xl font-extrabold text-foreground tracking-tight">
          Create Your Storefront
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Provide your store brand details and link your chat socials. Zero setup fees, instant deployment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} data-testid="store-onboarding-form">
         <fieldset
           disabled={!ready}
           data-testid="store-form-fields"
           className="space-y-6 m-0 min-w-0 border-0 p-0 disabled:opacity-60"
         >
          {message && (
            <div
              data-testid="store-form-message"
              className={`p-4 rounded-md text-sm font-semibold border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}
            >
              {message.text}
            </div>
          )}

          {/* Core Info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase" htmlFor="shopName">Shop Name</label>
              <Input
                id="shopName"
                name="name"
                data-testid="shop-name"
                required
                type="text"
                placeholder="e.g. Gadget Central"
                onChange={handleNameChange}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase flex items-center gap-1" htmlFor="shopSlug">
                Store URL Handle <span className="text-muted-foreground cursor-help" title="Custom slug: /store/your-slug"><HelpCircle size={12} /></span>
              </label>
              <Input
                id="shopSlug"
                name="slug"
                data-testid="shop-slug"
                ref={slugRef}
                required
                type="text"
                placeholder="e.g. gadget-central"
                onChange={(e) => {
                  slugTouched.current = true;
                  e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '');
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase" htmlFor="shopDescription">Description</label>
            <Textarea
              id="shopDescription"
              name="description"
              data-testid="shop-description"
              rows={3}
              placeholder="Tell buyers what you sell, what your delivery speeds are, and store rules..."
            />
          </div>

          {/* Socials & Contacts */}
          <div className="border-t border-zinc-200 pt-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Contacts & Channels</h3>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase" htmlFor="shopWhatsapp">WhatsApp Number</label>
                <Input
                  id="shopWhatsapp"
                  name="whatsapp"
                  data-testid="shop-whatsapp"
                  required
                  type="tel"
                  defaultValue="+91"
                  placeholder="e.g. +15551234567 (with country code)"
                  onChange={(e) => {
                    e.target.value = e.target.value.replace(/[^0-9+]/g, '');
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase" htmlFor="shopInstagram">Instagram (Optional)</label>
                <Input id="shopInstagram" name="instagram" type="text" placeholder="e.g. gadgetcentral_ig" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase" htmlFor="shopTelegram">Telegram (Optional)</label>
                <Input id="shopTelegram" name="telegram" type="text" placeholder="e.g. gadgetcentral_tg" />
              </div>
            </div>
          </div>

          {/* Location & Delivery */}
          <div className="border-t border-zinc-200 pt-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-1.5"><MapPin size={16} className="text-amber-600" /> Location & Delivery</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase" htmlFor="shopCity">City (Optional)</label>
                <Input id="shopCity" name="city" data-testid="shop-city" type="text" placeholder="e.g. Chennai" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase" htmlFor="shopRegion">State / Region (Optional)</label>
                <Input id="shopRegion" name="region" data-testid="shop-region" type="text" placeholder="e.g. Tamil Nadu" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase" htmlFor="shopDeliveryNote">Delivery Note (Optional)</label>
              <Input
                id="shopDeliveryNote"
                name="deliveryNote"
                type="text"
                maxLength={200}
                placeholder="e.g. Free shipping > ₹499; Ships in 24h; COD Available"
                onChange={(e) => setDeliveryPreview(e.target.value)}
              />
              <span className="text-[11px] text-muted-foreground font-normal normal-case">
                {"Separate multiple offers with a semicolon (e.g. 'Free shipping; Ships in 24h; 10% Off'). These will render as beautiful colored badges on your products."}
              </span>
              {deliveryPreview && (
                <div className="mt-2 p-2.5 border border-dashed border-zinc-200 rounded-lg bg-zinc-50/50">
                  <span className="text-[11px] font-bold text-muted-foreground/80 tracking-wider uppercase block mb-1">Live Offers Preview:</span>
                  <DeliveryOffersRow deliveryNote={deliveryPreview} isPreview />
                </div>
              )}
            </div>
          </div>

          {/* Images Uploads */}
          <div className="border-t border-zinc-200 pt-6 grid sm:grid-cols-2 gap-6">
            {/* Logo */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Shop Logo</span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center relative shrink-0">
                  {images.logo ? (
                    <NextImage src={images.logo} alt="Logo" width={64} height={64} className="h-full w-full object-cover" />
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
              <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Shop Banner (Optional)</span>
              <div className="flex items-center gap-4">
                <div className="h-16 w-32 rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center relative shrink-0">
                  {images.banner ? (
                    <NextImage src={images.banner} alt="Banner" width={128} height={64} className="h-full w-full object-cover" />
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

          <Button type="submit" disabled={isLoading || !ready} className="w-full mt-4" data-testid="store-submit">
            {!ready ? 'Preparing form…' : isLoading ? 'Creating Storefront...' : 'Deploy Shop Catalog'}
          </Button>
         </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

import { Shop } from '@prisma/client';

export function StoreSettingsForm({ shop }: { shop: SellerShopView }) {
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
    const res = await runAction(() => deleteShop());
    setDeleting(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      router.push('/sell');
    }
  };
  const [whatsappVerifiedAt, setWhatsappVerifiedAt] = React.useState(shop.whatsappVerifiedAt);
  /** A code is outstanding, so the entry box must be reachable even if verified. */
  const [codeRequested, setCodeRequested] = React.useState(false);
  /** Concurrency token: the row version this form was rendered from. */
  const [expectedUpdatedAt, setExpectedUpdatedAt] = React.useState<string>(
    new Date(shop.updatedAt).toISOString()
  );
  const [verificationCode, setVerificationCode] = React.useState('');
  const [verificationLoading, setVerificationLoading] = React.useState<'request' | 'confirm' | null>(null);

  const handlePauseToggle = async () => {
    setPauseLoading(true);
    const res = await runAction(() => toggleShopPause(!isPaused));
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
    if (isLoading) return;

    /**
     * Renaming the handle is destructive, so say so before it happens.
     *
     * Deleting the store makes the seller type its name to confirm. Changing
     * the address — which changes every link they have shared from this moment
     * on — was a bare text input with no warning at all. The severity of those
     * two interactions was inverted.
     *
     * The old address now redirects rather than dying, so this confirmation can
     * tell the truth rather than just being frightening.
     */
    if (formData.slug !== shop.slug) {
      const ok = window.confirm(
        `Change your store address from /${shop.slug} to /${formData.slug}?\n\n` +
          `Links you have already shared will keep working — we redirect the old address to the ` +
          `new one. But /${shop.slug} is retired for good and cannot be used again, by you or ` +
          `anyone else, and your store's address changes everywhere from now on.`
      );
      if (!ok) return;
    }

    setIsLoading(true);
    setMessage(null);

    const res = await runAction(() =>
      updateShop(shop.id, { ...formData, expectedUpdatedAt })
    );
    setIsLoading(false);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
      return;
    }

    setWhatsappVerifiedAt(res.shop?.whatsappVerifiedAt ?? null);
    // Track the new version so a second save from this tab is not treated as
    // a conflict with its own first save.
    if (res.shop?.updatedAt) setExpectedUpdatedAt(new Date(res.shop.updatedAt).toISOString());
    // A notice means something consequential happened that the seller did not
    // ask for — today, that their store left the marketplace because the
    // WhatsApp number changed. It stays on screen; a three-second toast is not
    // how you tell somebody their shop is hidden.
    if (res.notice) {
      setMessage({ type: 'error', text: res.notice });
      return;
    }

    setMessage({ type: 'success', text: 'Store configurations updated!' });
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  const handleRequestVerification = async () => {
    /**
     * The code goes to the *saved* number, not the one in the input.
     *
     * A seller who typed a new number and hit Send Code received the code on
     * their old handset, confirmed it, and was shown "Verified for <new
     * number>" — naming a number nobody had contacted. Blocking the request
     * until the change is saved keeps the message honest, and the save is what
     * clears the old verification anyway.
     */
    if (formData.whatsapp !== shop.whatsapp) {
      setMessage({
        type: 'error',
        text: 'Save your new number first — the code is sent to the number on file.',
      });
      return;
    }

    setVerificationLoading('request');
    const res = await runAction(() => requestWhatsappVerification());
    setVerificationLoading(null);

    if (!('success' in res)) {
      setMessage({ type: 'error', text: res.error || 'Unable to send verification code' });
      return;
    }

    // Without this the code box is hidden for an already-verified seller who
    // clicked Reverify, leaving them a live code and nowhere to type it.
    setCodeRequested(true);

    /**
     * An emailed code is not a failure, but it is not enough either.
     *
     * Confirming it marks the number verified over email, which does not list
     * the store — so a seller told only "code sent" verifies, is refused at
     * listing, is told to use WhatsApp, presses the same button, and loops.
     * The consequence belongs here, in the same breath as the code.
     *
     * It is shown as an error rather than a success because it is one: the
     * seller is about to spend effort on something that will not finish, and a
     * green tick is the wrong shape for that.
     */
    if (res.delivery === 'email') {
      setMessage({
        type: 'error',
        text:
          res.whatsappOutcome === 'failed'
            ? 'WhatsApp would not accept the message, so the code went to your email instead. ' +
              'This is a problem on our side, not with your number. You can confirm the emailed ' +
              'code, but your store will not be listed until WhatsApp delivery is working — ' +
              'please contact support rather than retrying.'
            : 'WhatsApp delivery is not switched on yet, so the code went to your email. ' +
              'You can confirm it, but your store will not appear in the marketplace until the ' +
              'number is confirmed on WhatsApp itself.',
      });
      return;
    }

    const target = res.delivery === 'whatsapp' ? 'WhatsApp' : 'the dev response';
    setMessage({
      type: 'success',
      text: `Verification code sent via ${target}. It expires in 10 minutes.${res.devCode ? ` Dev code: ${res.devCode}` : ''}`,
    });
  };

  const handleConfirmVerification = async () => {
    setVerificationLoading('confirm');
    const res = await runAction(() => confirmWhatsappVerification(verificationCode));
    setVerificationLoading(null);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
      return;
    }

    track('whatsapp_verified');
    setWhatsappVerifiedAt(new Date());
    setVerificationCode('');
    setCodeRequested(false);
    setMessage({ type: 'success', text: 'WhatsApp number verified.' });
  };

  return (
    <Card className="border-zinc-200 shadow-sm bg-card text-card-foreground">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-2xl font-bold text-foreground">Storefront Profile</CardTitle>
        <CardDescription className="text-muted-foreground">Modify your storefront catalog and linked contact details.</CardDescription>
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
                      ? `Verified for ${shop.whatsapp}. Changing the number unlists your store until you verify the new one.`
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

            {(!whatsappVerifiedAt || codeRequested) && (
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
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Shop Name</label>
              <Input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Store Handle</label>
              <Input
                required
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '') }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Description</label>
            <Textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="border-t border-zinc-200 pt-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Contacts & Channels</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">WhatsApp Number</label>
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
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Instagram Handle</label>
                <Input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => setFormData((prev) => ({ ...prev, instagram: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Telegram Handle</label>
                <Input
                  type="text"
                  value={formData.telegram}
                  onChange={(e) => setFormData((prev) => ({ ...prev, telegram: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Location & Delivery */}
          <div className="border-t border-zinc-200 pt-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-1.5"><MapPin size={16} className="text-amber-600" /> Location & Delivery</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">City</label>
                <Input
                  type="text"
                  placeholder="e.g. Chennai"
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">State / Region</label>
                <Input
                  type="text"
                  placeholder="e.g. Tamil Nadu"
                  value={formData.region}
                  onChange={(e) => setFormData((prev) => ({ ...prev, region: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Delivery Note</label>
              <Input
                type="text"
                maxLength={200}
                placeholder="e.g. Free shipping > ₹499; Ships in 24h; COD Available"
                value={formData.deliveryNote}
                onChange={(e) => setFormData((prev) => ({ ...prev, deliveryNote: e.target.value }))}
              />
              <span className="text-[11px] text-muted-foreground font-normal normal-case">
                {"Separate multiple offers with a semicolon (e.g. 'Free shipping; Ships in 24h; 10% Off'). These will render as beautiful colored badges on your products."}
              </span>
              {formData.deliveryNote && (
                <div className="mt-2 p-2.5 border border-dashed border-zinc-200 rounded-lg bg-zinc-50/50">
                  <span className="text-[11px] font-bold text-muted-foreground/80 tracking-wider uppercase block mb-1">Live Offers Preview:</span>
                  <DeliveryOffersRow deliveryNote={formData.deliveryNote} isPreview />
                </div>
              )}
            </div>
          </div>

          {/* Logo & Banner Editor */}
          <div className="border-t border-zinc-200 pt-6 grid sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Logo Preview</span>
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
              <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Banner Preview (Optional)</span>
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
