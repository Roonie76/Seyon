/**
 * The seller's notice inbox.
 *
 * The bug this covers: `NoticeCard` initialised `open` to `!notice.readAt`, so
 * an unread notice mounted expanded. The effect that marks a notice read runs
 * when `open` is true, and on the very first render it already was. Loading
 * /notices therefore marked every unread notice read without the seller having
 * read anything, fired one server action and one `router.refresh()` per notice,
 * and permanently destroyed the unread state — which is the evidence that
 * settles "I was never told".
 *
 * This renders the component rather than reading its source, because the bug
 * was in behaviour that both a type check and a build were happy with.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const markRead = vi.fn(async () => ({ success: true }));
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/backend/actions/notices', () => ({
  markNoticeReadAction: (...args: unknown[]) => markRead(...(args as [])),
  respondToNoticeAction: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/frontend/lib/run-action', () => ({
  runAction: async (fn: () => Promise<unknown>) => fn(),
}));

import { NoticeInbox } from '@/frontend/components/dashboard/notice-inbox';

function notice(over: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    kind: 'WARNING',
    subject: 'Listing photos',
    body: 'Please reshoot the third photo.',
    requiresResponse: false,
    respondBy: null,
    sentAt: new Date('2026-08-01T00:00:00Z'),
    emailedAt: null,
    readAt: null,
    respondedAt: null,
    response: null,
    ...over,
  } as never;
}

/**
 * Deliberately not @testing-library/react: its `@testing-library/dom` peer is
 * not installed here, and a regression guard is not worth a new dependency.
 * `createRoot` + `act` is the same thing with fewer moving parts.
 */
let container: HTMLDivElement;
let root: Root;

// React 19 logs a warning unless the environment opts in to act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
}

/** Lets pending microtasks and zero-delay timers settle inside act(). */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

const byTestId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const allByTestId = (id: string) =>
  Array.from(container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  markRead.mockClear();
  refresh.mockClear();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
});

describe('notice inbox', () => {
  it('does not mark anything read merely because the page loaded', async () => {
    await mount(
      <NoticeInbox notices={[notice({ id: 'a' }), notice({ id: 'b' }), notice({ id: 'c' })]} />
    );
    // Give any mount effect a chance to fire before asserting that it did not.
    await settle();
    expect(allByTestId('notice-item')).toHaveLength(3);
    expect(markRead).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('keeps unread notices collapsed until the seller opens one', async () => {
    await mount(<NoticeInbox notices={[notice()]} />);
    await settle();
    expect(byTestId('notice-body')).toBeNull();
    expect(byTestId('notice-unread')).not.toBeNull();
  });

  it('marks read on the first expand, and only once', async () => {
    await mount(<NoticeInbox notices={[notice()]} />);
    await settle();
    const toggle = byTestId('notice-toggle')!;

    await click(toggle);
    await settle();
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead).toHaveBeenCalledWith('n1');
    expect(byTestId('notice-body')).not.toBeNull();

    // Collapse and expand again: still one call.
    await click(toggle);
    await settle();
    await click(toggle);
    await settle();
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it('does not re-mark a notice that is already read', async () => {
    await mount(<NoticeInbox notices={[notice({ readAt: new Date('2026-08-02T00:00:00Z') })]} />);
    await settle();
    await click(byTestId('notice-toggle')!);
    await settle();
    expect(markRead).not.toHaveBeenCalled();
  });
});
