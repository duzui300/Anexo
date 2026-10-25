import { CommandCenter } from '@/features/command-center/CommandCenter';
import { useUiStore } from '@/stores/ui-store';
import { ComposerTools } from './ComposerTools';
import { OptimizerDialog } from './OptimizerDialog';
import { PromptPalette } from './PromptPalette';

export function OverlayApp() {
  const commandCenterOpen = useUiStore((state) => state.commandCenterOpen);
  const closeCommandCenter = useUiStore((state) => state.closeCommandCenter);

  return (
    <>
      <ComposerTools />
      {commandCenterOpen ? <CommandCenter onClose={closeCommandCenter} /> : null}
      <OptimizerDialog />
      <PromptPalette />
    </>
  );
}
