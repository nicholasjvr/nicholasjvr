/** Per-project accent palettes. Applied via `data-accent-theme` on `<html>` or cards. */
export type AccentTheme = 'default' | 'tradebot' | 'meeting-memory';

export interface AccentThemeTokens {
  label: string;
  accent: string;
  accent2: string;
  glow: string;
}

export const ACCENT_THEMES: Record<AccentTheme, AccentThemeTokens> = {
  default: {
    label: 'Portfolio',
    accent: '99 102 241',
    accent2: '236 72 153',
    glow: '139 92 246',
  },
  tradebot: {
    label: 'TradeBot',
    accent: '139 92 246',
    accent2: '236 72 153',
    glow: '168 85 247',
  },
  'meeting-memory': {
    label: 'Meeting Me Memory',
    accent: '14 165 233',
    accent2: '6 182 212',
    glow: '56 189 248',
  },
};
