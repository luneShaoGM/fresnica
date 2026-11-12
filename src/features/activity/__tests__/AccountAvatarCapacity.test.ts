import type React from 'react';
import { createAccountAvatarPort, type AccountAvatarPort } from '../../../capabilities/contacts/AccountAvatars';
import { AccountAvatar } from '../../contacts/AccountAvatar';

type Effect = { deps: readonly unknown[]; cleanup?: () => void };
type Mounted = {
  address: string; active: boolean; dirty: boolean;
  refs: Array<{ current: unknown }>; effects: Effect[];
  refIndex: number; effectIndex: number; pending: Array<() => void>;
  unsubscribe?: () => void;
  element?: React.ReactElement<{ uri?: string; onError?: () => void }>;
};
const mockHarness = {
  service: undefined as AccountAvatarPort | undefined,
  current: undefined as Mounted | undefined,
};
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: () => mockHarness.service,
  useSyncExternalStore: (subscribe: (notify: () => void) => () => void, read: () => unknown) => {
    const view = mockHarness.current!;
    view.unsubscribe ??= subscribe(() => { view.dirty = true; });
    return read();
  },
  useRef: (initial: unknown) => {
    const view = mockHarness.current!;
    const index = view.refIndex++;
    return view.refs[index] ?? (view.refs[index] = { current: initial });
  },
  useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
    const view = mockHarness.current!;
    const index = view.effectIndex++;
    const previous = view.effects[index];
    if (previous && deps.length === previous.deps.length && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
    view.pending.push(() => {
      previous?.cleanup?.();
      const cleanup = effect();
      view.effects[index] = { deps, ...(cleanup ? { cleanup } : {}) };
    });
  },
}));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));

async function settle(views: Mounted[], turns = 300) {
  for (let i = 0; i < turns; i++) {
    for (const view of views) {
      if (!view.dirty) continue;
      view.dirty = false;
      view.refIndex = view.effectIndex = 0;
      mockHarness.current = view;
      view.element = AccountAvatar({ address: view.address, active: view.active });
      for (const effect of view.pending.splice(0)) effect();
    }
    for (let tick = 0; tick < 5; tick++) await Promise.resolve();
  }
}

it('65 mounted subscribed avatars settle after successful downloads instead of evicting/reloading each other', async () => {
  const uri = 'data:image/png;base64,AAAA';
  const loadImage = jest.fn(async () => uri);
  const service = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage });
  service.setReadable(true);
  mockHarness.service = service;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const views: Mounted[] = Array.from({ length: 65 }, (_, i) => ({
    address: 'G' + 'A'.repeat(53) + alphabet[Math.floor(i / 32)] + alphabet[i % 32],
    active: true, dirty: true, refs: [], effects: [], refIndex: 0, effectIndex: 0, pending: [],
  }));
  try {
    await settle(views);
    expect(loadImage).toHaveBeenCalledTimes(65);
    expect(views.filter(view => view.element?.props.uri === uri)).toHaveLength(64);
    const stable = views.map(view => view.element?.props.uri);
    views.forEach(view => { view.dirty = true; });
    await settle(views);
    expect(loadImage).toHaveBeenCalledTimes(65);
    expect(views.map(view => view.element?.props.uri)).toEqual(stable);

    // An explicit reactivation may reclaim a slot once; its eviction cannot restart the loop.
    const evicted = views.find(view => !view.element?.props.uri)!;
    evicted.active = false;
    evicted.dirty = true;
    await settle(views, 5);
    evicted.active = true;
    evicted.dirty = true;
    await settle(views);
    expect(loadImage).toHaveBeenCalledTimes(66);
    expect(evicted.element?.props.uri).toBe(uri);
    const nextStable = views.map(view => view.element?.props.uri);
    await settle(views);
    expect(loadImage).toHaveBeenCalledTimes(66);
    expect(views.map(view => view.element?.props.uri)).toEqual(nextStable);
  } finally {
    for (const view of views) {
      view.unsubscribe?.();
      for (const effect of view.effects) effect.cleanup?.();
    }
    service.close();
    mockHarness.service = undefined;
    mockHarness.current = undefined;
  }
});
