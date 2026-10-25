import { createRoot, type Root } from 'react-dom/client';
import baseCss from '@/ui/base.css?inline';
import surfaceCss from '@/ui/surface.css?inline';
import tokensCss from '@/ui/tokens.css?inline';
import { Z_INDEX } from '@/ui/z-index';
import type { ResolvedTheme } from './theme';

export type SurfaceName = 'sidebar' | 'rail' | 'overlay';

export interface Surface {
  name: SurfaceName;
  host: HTMLDivElement;
  shadow: ShadowRoot;
  root: HTMLDivElement;
  reactRoot: Root;
  destroy: () => void;
}

function applyHostPlacement(host: HTMLDivElement, name: SurfaceName): void {
  if (name === 'rail') {
    Object.assign(host.style, {
      position: 'fixed',
      top: 'auto',
      right: '12px',
      bottom: '16px',
      width: '44px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: '72vh',
      zIndex: String(Z_INDEX.rail),
      pointerEvents: 'none',
      transition: 'width 320ms cubic-bezier(0.22, 0.7, 0.25, 1)',
    });
    return;
  }

  if (name === 'overlay') {
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: String(Z_INDEX.overlay),
      pointerEvents: 'none',
    });
    return;
  }

  if (name === 'sidebar') {
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: String(Z_INDEX.sidebar),
      pointerEvents: 'none',
    });
    return;
  }
}

export function createSurface(name: SurfaceName): Surface {
  const host = document.createElement('div');
  host.id = `anexo-${name}-host`;
  host.dataset.anexoSurface = name;
  applyHostPlacement(host, name);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `${tokensCss}\n${baseCss}\n${surfaceCss}`;

  const root = document.createElement('div');
  root.className = 'ax-root';
  root.dataset.axTheme = 'light';

  shadow.append(style, root);
  const reactRoot = createRoot(root);

  return {
    name,
    host,
    shadow,
    root,
    reactRoot,
    destroy: () => {
      reactRoot.unmount();
      host.remove();
    },
  };
}

export function applyTheme(surfaces: readonly Surface[], theme: ResolvedTheme): void {
  for (const surface of surfaces) {
    surface.host.dataset.axTheme = theme;
    surface.root.dataset.axTheme = theme;
  }
}
