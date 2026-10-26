import { startRequestDeepLinkIntake } from '../startRequestDeepLinkIntake';
function setup() {
  let warm!: (url: string) => void;
  let initial!: (url: string | undefined) => void;
  const unsubscribe = jest.fn();
  const onCapture = jest.fn();
  const onFailure = jest.fn();
  const port = {
    subscribe: (listener: typeof warm) => {
      warm = listener;
      return unsubscribe;
    },
    getInitialUrl: jest.fn(
      () =>
        new Promise<string | undefined>(resolve => {
          initial = resolve;
        }),
    ),
  };
  const owner = startRequestDeepLinkIntake({ port, onCapture, onFailure });
  return {
    owner,
    port,
    onCapture,
    onFailure,
    unsubscribe,
    warm: (url: string) => warm(url),
    initial: (url: string | undefined) => initial(url),
  };
}
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
it('buffers cold startup until readiness and ignores duplicate delivery through foreground resumes', async () => {
  const s = setup();
  await settle();
  s.initial('request-a');
  await settle();
  expect(s.onCapture).not.toHaveBeenCalled();
  s.owner.setReady(true);
  s.warm('request-a');
  s.owner.setReady(false);
  s.owner.setReady(true);
  expect(s.onCapture.mock.calls).toEqual([['request-a']]);
  s.owner.dismiss();
  s.warm('request-a');
  expect(s.onCapture.mock.calls).toEqual([['request-a'], ['request-a']]);
  s.owner.close();
});
it('keeps only the latest warm input before readiness and never overwrites it with a late initial URL', async () => {
  const s = setup();
  await settle();
  s.warm('request-a');
  s.warm('request-b');
  s.initial('old-cold-request');
  await settle();
  s.owner.setReady(true);
  expect(s.onCapture.mock.calls).toEqual([['request-b']]);
  s.owner.setReady(false);
  s.warm('request-c');
  expect(s.onCapture).toHaveBeenCalledTimes(1);
  s.owner.setReady(true);
  expect(s.onCapture).toHaveBeenLastCalledWith('request-c');
  s.owner.close();
});
it('does not resurrect a dismissed warm link when initial lookup finishes later', async () => {
  const s = setup();
  s.owner.setReady(true);
  s.warm('request-a');
  s.owner.dismiss();
  await settle();
  s.initial('request-a');
  await settle();
  expect(s.onCapture).toHaveBeenCalledTimes(1);
  s.owner.close();
});
it('disposes once, drops queued/late callbacks and avoids queued initial IO after close', async () => {
  const s = setup();
  s.warm('request-a');
  s.owner.close();
  s.owner.close();
  s.owner.setReady(true);
  s.warm('request-b');
  await settle();
  expect(s.onCapture).not.toHaveBeenCalled();
  expect(s.unsubscribe).toHaveBeenCalledTimes(1);
  expect(s.port.getInitialUrl).not.toHaveBeenCalled();
  const late = setup();
  await settle();
  late.owner.close();
  late.initial('late');
  await settle();
  expect(late.onCapture).not.toHaveBeenCalled();
});
it('reports initial lookup failure without losing later warm input', async () => {
  const s = setup();
  s.port.getInitialUrl.mockRejectedValueOnce(new Error('private raw URL'));
  await settle();
  expect(s.onFailure).toHaveBeenCalledWith();
  s.owner.setReady(true);
  s.warm('request-a');
  expect(s.onCapture).toHaveBeenCalledWith('request-a');
  s.owner.close();
});
