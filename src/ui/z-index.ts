// Injected UI must sit above ChatGPT's own fixed header and dialogs. Keep
// these near the top of the 32-bit z-index range so host-page stacking
// contexts cannot cover the rail, overlay or Command Center.
export const Z_INDEX = {
  sidebar: 2_147_482_999,
  rail: 2_147_483_000,
  overlay: 2_147_483_001,
  toast: 2_147_483_002,
  modal: 2_147_483_003,
  menu: 2_147_483_004,
} as const;
