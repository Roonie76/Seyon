'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteBlogTopic } from '@/backend/actions/blog-topics';
import { runAction } from '@/frontend/lib/run-action';

/**
 * Deleting a hub, behind a typed confirmation.
 *
 * Unlike a post, a hub is an address other people have already linked to and
 * search engines have already indexed. Deleting one turns every one of those
 * into a 404, and there is no undo. The other destructive actions in this
 * admin ask for the name to be typed before they proceed; this matches them,
 * and says the reversible alternative out loud.
 */
export function DeleteTopicButton({
  id,
  label,
  slug,
}: {
  id: string;
  label: string;
  slug: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirmed = typed.trim().toLowerCase() === slug.toLowerCase();

  async function onDelete() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    const res = await runAction(() => deleteBlogTopic(id));
    if (res.error || !res.success) {
      setError(res.error || 'Could not delete the hub.');
      setBusy(false);
      return;
    }
    router.push('/admin/blog/topics');
    router.refresh();
  }

  if (!armed) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
        <p className="text-sm font-semibold text-rose-900">Delete this hub</p>
        <p className="mt-1 text-xs text-rose-800">
          /blog/topic/{slug} becomes a 404 for anyone who has linked to it or found it in
          search. Unpublishing hides it from the site and the sitemap while keeping the
          address alive — prefer that unless the hub was a mistake.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 border-rose-300 text-rose-800 hover:bg-rose-100"
          onClick={() => setArmed(true)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete “{label}”
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-rose-900">
        Type <code className="font-mono">{slug}</code> to confirm.
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="w-full rounded-lg border border-rose-300 px-3 py-2 text-sm"
        placeholder={slug}
        autoComplete="off"
      />
      {error && (
        <p role="alert" className="text-xs font-semibold text-rose-800">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={!confirmed || busy}
          onClick={onDelete}
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
          Delete permanently
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setArmed(false);
            setTyped('');
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
