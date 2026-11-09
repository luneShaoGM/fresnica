import type { HomeAssetCategory } from '../../features/home/components/AssetCategoryDialog';

export type HomeAssetCategorySelection = Readonly<{ value: HomeAssetCategory; epoch: number }>;

// An epoch is tied to a single selection, not the category name. If a user
// switches away and back before React commits, the original claim authorization
// remains retired even though the same category is visible again.
export function advanceHomeAssetCategory(
  previous: HomeAssetCategorySelection,
  value: HomeAssetCategory,
): HomeAssetCategorySelection {
  return { value, epoch: previous.epoch + 1 };
}

export function isCurrentClaimableCategory(latest: HomeAssetCategorySelection, reviewedEpoch: number): boolean {
  return latest.value === 'claimable' && latest.epoch === reviewedEpoch;
}
