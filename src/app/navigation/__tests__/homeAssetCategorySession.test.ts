import { advanceHomeAssetCategory, isCurrentClaimableCategory } from '../homeAssetCategorySession';

describe('Home Claimable category lifetime', () => {
  it('never revives an old claim after Assets -> Claimable even in a single batched render', () => {
    const original = { value: 'claimable' as const, epoch: 7 };
    expect(isCurrentClaimableCategory(original, 7)).toBe(true);

    const assets = advanceHomeAssetCategory(original, 'tokens');
    const again = advanceHomeAssetCategory(assets, 'claimable');
    expect(isCurrentClaimableCategory(assets, 7)).toBe(false);
    expect(isCurrentClaimableCategory(again, 7)).toBe(false);
    expect(isCurrentClaimableCategory(again, again.epoch)).toBe(true);
    expect(again.epoch).toBe(9);
  });

  it('retire old authorization when user selects the same category again', () => {
    const previous = { value: 'claimable' as const, epoch: 4 };
    const next = advanceHomeAssetCategory(previous, 'claimable');
    expect(isCurrentClaimableCategory(next, 4)).toBe(false);
  });

  it('cannot authorize a claim in Tokens and does not mutate existing snapshot', () => {
    const initial = Object.freeze({ value: 'tokens' as const, epoch: 0 });
    const claimable = advanceHomeAssetCategory(initial, 'claimable');
    expect(initial).toEqual({ value: 'tokens', epoch: 0 });
    expect(isCurrentClaimableCategory(initial, 0)).toBe(false);
    expect(isCurrentClaimableCategory(claimable, 0)).toBe(false);
    expect(isCurrentClaimableCategory(claimable, 1)).toBe(true);
  });
});
