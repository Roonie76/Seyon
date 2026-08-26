'use client';

import * as React from 'react';
import { Camera, Save, Loader2, User, Mail, Phone, Shield, CalendarDays, Check, MapPin, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { updateUserProfile, updateUserAddress } from '@/backend/actions/user-profile';
import { BackButton } from '@/components/shared/back-button';

interface ProfileEditorProps {
  user: {
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
  };
  type: 'shopper' | 'seller';
}

export function ProfileEditor({ user, type }: ProfileEditorProps) {
  const [name, setName] = React.useState(user.name || '');
  const [phone, setPhone] = React.useState(user.phone || '');
  const [image, setImage] = React.useState(user.image || '');
  const [addressLine1, setAddressLine1] = React.useState(user.addressLine1 || '');
  const [addressLine2, setAddressLine2] = React.useState(user.addressLine2 || '');
  const [city, setCity] = React.useState(user.city || '');
  const [state, setState] = React.useState(user.state || '');
  const [postalCode, setPostalCode] = React.useState(user.postalCode || '');
  const [country, setCountry] = React.useState(user.country || 'India');
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const hasChanges =
    name !== (user.name || '') ||
    phone !== (user.phone || '') ||
    image !== (user.image || '') ||
    addressLine1 !== (user.addressLine1 || '') ||
    addressLine2 !== (user.addressLine2 || '') ||
    city !== (user.city || '') ||
    state !== (user.state || '') ||
    postalCode !== (user.postalCode || '') ||
    country !== (user.country || 'India');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be under 5MB' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Use JPEG, PNG, WEBP, or GIF format' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'avatars');

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setImage(data.url);
      setMessage({ type: 'success', text: 'Photo uploaded! Click Save to apply.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const result = await updateUserProfile(type, { name, phone, image });
    let addressResult: { success: boolean; error?: string } = { success: true };

    if (type === 'shopper') {
      addressResult = await updateUserAddress({
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
      });
    }

    if (result.success && addressResult.success) {
      setMessage({ type: 'success', text: 'Profile and shipping address updated successfully!' });
    } else {
      setMessage({ type: 'error', text: result.error || addressResult.error || 'Failed to save changes' });
    }

    setSaving(false);
  };

  const roleBadgeColor: Record<string, string> = {
    ADMIN: 'bg-red-50 text-red-700 border-red-200',
    SELLER: 'bg-amber-50 text-[#A77F3A] border-amber-200',
    USER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <BackButton fallbackHref={type === 'seller' ? '/dashboard' : '/marketplace'} />
      {/* Header */}
      <div className="mb-8 mt-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
          {type === 'seller' ? 'Seller Account' : 'My Account'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {type === 'seller' ? 'Manage your seller profile information' : 'Manage your shopper profile information'}
        </p>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-md overflow-hidden">
        {/* Avatar Section */}
        <div className="relative bg-[#FAF8F5] px-6 py-8 flex flex-col items-center border-b border-zinc-200">
          <div className="relative group">
            <div className="h-24 w-24 rounded-full border border-zinc-200 overflow-hidden bg-zinc-50 shadow-sm transition-all group-hover:border-[#A77F3A]/50">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={name || 'Profile'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-zinc-100 text-zinc-400">
                  <User className="h-10 w-10 stroke-[1]" />
                </div>
              )}
            </div>

            {/* Upload overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <span className="mt-3 text-lg font-bold text-zinc-900 font-serif" style={{ fontFamily: 'Georgia, serif' }}>
            {name || 'Unnamed'}
          </span>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${roleBadgeColor[user.role] || roleBadgeColor.USER}`}
            >
              <Shield className="h-3 w-3" />
              {user.role}
            </span>
          </div>
        </div>

        {/* Fields Section */}
        <div className="px-6 py-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              <User className="h-3.5 w-3.5 text-zinc-400" />
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={100}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#A77F3A] focus:ring-1 focus:ring-[#A77F3A]/20 transition-colors"
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              <Mail className="h-3.5 w-3.5 text-zinc-400" />
              Email
              <span className="text-[11px] font-normal normal-case tracking-normal text-zinc-550 ml-1">(cannot be changed)</span>
            </label>
            <div className="w-full rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-500 cursor-not-allowed select-none">
              {user.email || '—'}
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              <Phone className="h-3.5 w-3.5 text-zinc-400" />
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#A77F3A] focus:ring-1 focus:ring-[#A77F3A]/20 transition-colors"
            />
          </div>

          {/* Shopper Address Details */}
          {type === 'shopper' && (
            <>
              <div className="pt-4 border-t border-zinc-200">
                <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#A77F3A]" /> Shipping Address (WhatsApp Pre-fill)
                </h3>
                <p className="text-[11px] text-zinc-500 leading-normal mb-4">
                  This address will be automatically appended to WhatsApp inquiry messages.
                </p>
              </div>

              {/* Address Line 1 */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Flat, House no., Building, Company, Apartment"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#A77F3A] focus:ring-1 focus:ring-[#A77F3A]/20 transition-colors"
                />
              </div>

              {/* Address Line 2 */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Area, Street, Sector, Village"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#A77F3A] focus:ring-1 focus:ring-[#A77F3A]/20 transition-colors"
                />
              </div>

              {/* City & State */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#A77F3A] focus:ring-1 focus:ring-[#A77F3A]/20 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#A77F3A] focus:ring-1 focus:ring-[#A77F3A]/20 transition-colors"
                  />
                </div>
              </div>

              {/* ZIP & Country */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Postal / ZIP Code
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="600001"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#A77F3A] focus:ring-1 focus:ring-[#A77F3A]/20 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#A77F3A] focus:ring-1 focus:ring-[#A77F3A]/20 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* Member Since (read-only) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
              Member Since
            </label>
            <div className="w-full rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-500 cursor-not-allowed select-none">
              {new Date(user.createdAt).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Message + Save */}
        <div className="px-6 pb-6 space-y-4">
          {/* Status Message */}
          {message && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold border ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {message.type === 'success' ? <Check className="h-3.5 w-3.5" /> : null}
              {message.text}
            </div>
          )}

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#A77F3A] hover:bg-[#916b2f] disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-semibold text-sm uppercase tracking-wider py-3 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>

          {/* Sign Out Button */}
          <div className="pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{ backgroundColor: '#DA0000' }}
              className="w-full flex items-center justify-center gap-2 rounded-lg text-white font-extrabold text-xs uppercase tracking-wider py-3 shadow-xs hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4 stroke-[2.5]" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
