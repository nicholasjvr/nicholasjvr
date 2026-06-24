/** Per-project accent palettes. Applied via `data-accent-theme` on `<html>` or cards. */
export type AccentTheme =
  | 'default'
  | 'tradebot'
  | 'meeting-memory'
  | 'cinhaus'
  | 'wakatime'
  | 'sportsopp'
  | 'truckloader';

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
  cinhaus: {
    label: 'CinHaus',
    accent: '200 240 74',
    accent2: '245 244 240',
    glow: '200 240 74',
  },
  wakatime: {
    label: 'WakaTime Alarm',
    accent: '0 173 131',
    accent2: '52 211 153',
    glow: '16 185 129',
  },
  sportsopp: {
    label: 'SportsOpp',
    accent: '249 115 22',
    accent2: '234 88 12',
    glow: '251 146 60',
  },
  truckloader: {
    label: 'Truckloader',
    accent: '234 179 8',
    accent2: '202 138 4',
    glow: '250 204 21',
  },
};
