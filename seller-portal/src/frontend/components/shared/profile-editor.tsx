'use client';

import * as React from 'react';
import { Camera, Save, Loader2, User, Mail, Phone, Shield, CalendarDays, Check } from 'lucide-react';
import { updateUserProfile } from '@/backend/actions/user-profile';
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
  };
  type: 'shopper' | 'seller';
}

export function ProfileEditor({ user, type }: ProfileEditorProps) {
  const [name, setName] = React.useState(user.name || '');
  const [phone, setPhone] = React.useState(user.phone || '');
  const [image, setImage] = React.useState(user.image || '');
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const hasChanges =
    name !== (user.name || '') ||
    phone !== (user.phone || '') ||
    image !== (user.image || '');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
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

    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save' });
    }

    setSaving(false);
  };

  const roleBadgeColor: Record<string, string> = {
    ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
    SELLER: 'bg-amber-50/10 text-amber-400 border-amber-500/20',
    USER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <BackButton fallbackHref={type === 'seller' ? '/dashboard' : '/marketplace'} />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {type === 'seller' ? 'Seller Account' : 'My Account'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {type === 'seller' ? 'Manage your seller profile information' : 'Manage your shopper profile information'}
        </p>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm shadow-xl overflow-hidden">
        {/* Avatar Section */}
        <div className="relative bg-gradient-to-br from-zinc-800/50 via-zinc-900 to-zinc-950 px-6 py-8 flex flex-col items-center border-b border-zinc-800">
          <div className="relative group">
            <div className="h-24 w-24 rounded-full border-2 border-zinc-700 overflow-hidden bg-zinc-800 shadow-lg transition-all group-hover:border-primary/50">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={name || 'Profile'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-zinc-800 text-zinc-400">
                  <User className="h-10 w-10 stroke-[1]" />
                </div>
              )}
            </div>

            {/* Upload overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
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

          <span className="mt-3 text-lg font-bold text-white">{name || 'Unnamed'}</span>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadgeColor[user.role] || roleBadgeColor.USER}`}
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
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <User className="h-3.5 w-3.5" />
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={100}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Mail className="h-3.5 w-3.5" />
              Email
              <span className="text-[9px] font-normal normal-case tracking-normal text-zinc-500 ml-1">(cannot be changed)</span>
            </label>
            <div className="w-full rounded-lg border border-zinc-800 bg-zinc-850/30 px-4 py-2.5 text-sm text-zinc-500 cursor-not-allowed select-none">
              {user.email || '—'}
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Phone className="h-3.5 w-3.5" />
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>

          {/* Member Since (read-only) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <CalendarDays className="h-3.5 w-3.5" />
              Member Since
            </label>
            <div className="w-full rounded-lg border border-zinc-800 bg-zinc-850/30 px-4 py-2.5 text-sm text-zinc-500 cursor-not-allowed select-none">
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
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
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
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-semibold text-sm uppercase tracking-wider py-3 transition-colors cursor-pointer disabled:cursor-not-allowed"
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
        </div>
      </div>
    </div>
  );
}
