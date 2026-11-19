import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// react-native-screens 4.27.0 + Material 1.13.0: skipCollapsed bypasses
// shouldHide's distance test on nested-scroll release. Coincident expanded and
// collapsed heights preserve one detent while restoring Material's threshold.
// Remove this patch when upgrading to an upstream fix, after native acceptance.
export const sheetPatch = [
  {
    file: 'android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetBehaviorExt.kt',
    before: '0fb001e2f4c27aca79b0201a0c476eb887eb45931c88df67e6d952e52ef11db4',
    after: '673868674b83434c44643a897b20fc8f71e9bcaad0b60388676efb9fb5b3cb95',
    edits: [
      [
        `internal fun <T : View> BottomSheetBehavior<T>.useSingleDetent(
    maxAllowedHeight: Int? = null,
    forceExpandedState: Boolean = true,
    enableManualInsetsAdjustmentWorkaround: Boolean? = null,
): BottomSheetBehavior<T> {
    this.skipCollapsed = true
    this.isFitToContents = true
    if (forceExpandedState) {
        this.state = BottomSheetBehavior.STATE_EXPANDED
    }
    maxAllowedHeight?.let {
        this.maxHeight = maxAllowedHeight
    }
    maybeApplyManualInsetsAdjustmentWorkaround(enableManualInsetsAdjustmentWorkaround)
    return this
}

`,
        `internal fun <T : View> BottomSheetBehavior<T>.useSingleDetent(
    maxAllowedHeight: Int? = null,
    forceExpandedState: Boolean = true,
    enableManualInsetsAdjustmentWorkaround: Boolean? = null,
): BottomSheetBehavior<T> {
    // Fresnica: one resting height, with Material's short-pull hide threshold enabled.
    this.skipCollapsed = false
    this.isFitToContents = true
    if (forceExpandedState) {
        this.state = BottomSheetBehavior.STATE_EXPANDED
    }
    maxAllowedHeight?.let {
        this.maxHeight = maxAllowedHeight
        this.peekHeight = maxAllowedHeight
    }
    maybeApplyManualInsetsAdjustmentWorkaround(enableManualInsetsAdjustmentWorkaround)
    return this
}

`,
      ],
    ],
  },
  {
    file: 'android/src/main/java/com/swmansion/rnscreens/bottomsheet/SheetDelegate.kt',
    before: '6fa84feaed18a2751d12951e88a67aa35234f0bd9e70474b05f3a7f1dff70029',
    after: '3e547490349d4e72aef7488d09c2a80a365dae5763751cba5134394a5e74421c',
    edits: [
      [
        '        behavior.updateMetrics(maxAllowedHeight, expandedOffsetFromTop)',
        `        behavior.updateMetrics(maxAllowedHeight, expandedOffsetFromTop)
        if (screen.sheetDetents.count == 1 && maxAllowedHeight != null) {
            behavior.peekHeight = maxAllowedHeight
        }`,
      ],
    ],
  },
  {
    file: 'android/src/main/java/com/swmansion/rnscreens/bottomsheet/SheetUtils.kt',
    before: '947219f636b32f63c3a29e21007bcc9ad292e31150cc4958b0fd2c56a17b30a2',
    after: '45558f9e556e96c489050011435003418c4a4ad8fca5ad0b8247d1e9a7de2570',
    edits: [
      [
        `                    STATE_EXPANDED -> 0
`,
        `                    STATE_EXPANDED, STATE_COLLAPSED -> 0
`,
      ],
    ],
  },
];

const digest = source => createHash('sha256').update(source).digest('hex');

export function applyNativeSheetPatch(root, checkOnly = false) {
  const packageRoot = resolve(root, 'node_modules/react-native-screens');
  const { version } = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  if (version !== '4.27.0') throw new Error(`Revalidate native sheet patch for react-native-screens ${version}`);
  const pending = [];
  for (const patch of sheetPatch) {
    const path = resolve(packageRoot, patch.file);
    const source = readFileSync(path, 'utf8');
    const hash = digest(source);
    if (hash === patch.after) continue;
    if (hash !== patch.before) throw new Error(`Native sheet patch source mismatch: ${patch.file}`);
    let updated = source;
    for (const [before, after] of patch.edits) updated = updated.replace(before, after);
    if (digest(updated) !== patch.after) throw new Error(`Native sheet patch result mismatch: ${patch.file}`);
    pending.push({ path, updated });
  }
  if (checkOnly && pending.length) throw new Error('Native sheet patch is missing. Run npm run postinstall.');
  for (const { path, updated } of pending) writeFileSync(path, updated);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyNativeSheetPatch(resolve(import.meta.dirname, '..'), process.argv.includes('--check'));
}
