import type { ForegroundAccountSync } from '../readModels/createForegroundAccountSync';
import type { createSwapSelectionStore } from './swapSelectionStore';

// Follow the existing committed selection owner, including A→B→A before React renders.
export function bindForegroundAccountSync(
  selection: ReturnType<typeof createSwapSelectionStore>,
  sync: Pick<ForegroundAccountSync, 'setAccount'>,
): () => void {
  const update = () => {
    const current = selection.getCurrentSelection();
    sync.setAccount(current?.accounts.find(account => account.id === current.selectedAccountId));
  };
  const unsubscribe = selection.subscribe(update);
  update();
  return () => {
    unsubscribe();
    sync.setAccount(undefined);
  };
}
