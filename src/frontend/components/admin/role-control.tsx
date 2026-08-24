'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import { updateUserRoleAction } from '@/actions/admin';
import { runAction } from '@/frontend/lib/run-action';

/**
 * Changing what someone is allowed to do.
 *
 * The server action behind this has had the real guards for a while — it
 * refuses to let you demote yourself, refuses to demote the last remaining
 * admin, demands a reason for any change involving admin, writes an audit row
 * in the same transaction, and emails every existing admin when someone gains
 * admin. Until this component existed there was no way to invoke any of it, so
 * roles were changed with SQL and none of those guards ever ran.
 *
 * The disabled states here are a courtesy, not the enforcement: the server
 * re-checks every one of them, because a disabled button in a browser stops
 * nobody who means it.
 */
export function RoleControl({
  userId,
  email,
  currentRole,
  isSelf,
  isLastAdmin,
}: {
  userId: string;
  email: string | null;
  currentRole: Role;
  isSelf: boolean;
  isLastAdmin: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<Role | null>(null);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const involvesAdmin = target === Role.ADMIN || currentRole === Role.ADMIN;
  const blocked = isSelf && currentRole === Role.ADMIN;

  async function apply() {
    if (!target) return;
    setBusy(true); setError(null);
    const res = await runAction(() => updateUserRoleAction(userId, target, reason.trim() || undefined));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setTarget(null); setReason(''); setBusy(false); router.refresh();
  }

  if (blocked) {
    return (
      <p data-testid="role-self-locked" className="max-w-64 text-right text-[10px] font-semibold text-zinc-500">
        You cannot change your own admin access. Ask another admin.
      </p>
    );
  }

  if (isLastAdmin) {
    return (
      <p data-testid="role-last-admin-locked" className="max-w-64 text-right text-[10px] font-semibold text-zinc-500">
        The only admin. Promote someone else first.
      </p>
    );
  }

  return (
    <div className="w-full max-w-80 sm:w-auto">
      <div className="flex items-center justify-end gap-2">
        <select
          data-testid="role-select"
          aria-label={`Role for ${email ?? userId}`}
          value={target ?? currentRole}
          onChange={(e) => { setTarget(e.target.value as Role); setReason(''); setError(null); }}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-[11px] font-semibold"
        >
          {Object.values(Role).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {target && target !== currentRole ? (
        <div className="mt-2 space-y-1.5">
          {involvesAdmin ? (
            <input
              data-testid="role-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is admin access changing?"
              className="w-full rounded border border-zinc-300 px-2 py-1 text-[11px]"
            />
          ) : null}
          {error ? (
            <p role="alert" data-testid="role-error" className="text-[11px] font-semibold text-red-600">{error}</p>
          ) : null}
          <div className="flex justify-end gap-1">
            <button
              type="button"
              data-testid="role-confirm"
              onClick={apply}
              disabled={busy || (involvesAdmin && reason.trim().length < 10)}
              className="rounded bg-zinc-900 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
            >
              {currentRole} → {target}
            </button>
            <button
              type="button"
              onClick={() => { setTarget(null); setError(null); }}
              className="rounded border border-zinc-300 px-2 py-1 text-[10px] font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
