import { shouldDismissSheetSwipe } from '../AppModal';

describe('AppModal sheet drag-dismiss threshold', () => {
  it('closes after a deliberate downward distance', () => {
    expect(shouldDismissSheetSwipe(111, 0)).toBe(true);
    expect(shouldDismissSheetSwipe(110, 0)).toBe(false);
  });
  it('closes on a downward flick, but not a small accidental movement', () => {
    expect(shouldDismissSheetSwipe(30, 1.3)).toBe(true);
    expect(shouldDismissSheetSwipe(10, 2)).toBe(false);
  });
  it('keeps the sheet open after upward or short slow gestures', () => {
    expect(shouldDismissSheetSwipe(-120, -2)).toBe(false);
    expect(shouldDismissSheetSwipe(32, 0.4)).toBe(false);
  });
});
