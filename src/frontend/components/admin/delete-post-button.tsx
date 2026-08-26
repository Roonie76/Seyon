'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';

/**
 * Delete, with a confirmation and without crossing the boundary.
 *
 * The admin blog list is a Server Component, and it used to attach an
 * `onClick` confirm directly to the delete button. React cannot serialise a
 * function across that boundary, so the page threw — but only once a row
 * existed to render the handler, which is why an empty blog looked healthy for
 * months and broke on the day it had content.
 *
 * The handler lives here instead. The server action arrives as a prop, which
 * is allowed: an action is a serialisable reference, a closure is not.
 */
export function DeletePostButton({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton title={title} />
    </form>
  );
}

/**
 * Separate because `useFormStatus` reports on the nearest parent form, so it
 * has to be a child of it rather than a sibling of the action.
 */
function SubmitButton({ title }: { title: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      size="icon"
      variant="ghost"
      type="submit"
      // Deleting twice is not harmful -- the second call finds nothing -- but a
      // destructive control that stays clickable while it works invites it.
      disabled={pending}
      aria-label={`Delete ${title}`}
      className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </Button>
  );
}
