const palette = {
  black:   '#000000',
  card:    '#1c1c1e',
  card2:   '#2c2c2e',
  border:  '#38383a',
  bull:    '#30d158',
  bear:    '#ff453a',
  neutral: '#ffd60a',
  info:    '#0a84ff',
  ai:      '#bf5af2',
  white:   '#ffffff',
  muted:   '#8e8e93',
  muted2:  '#636366',
  accent:  '#0a84ff',
};

export const colors = {
  dark: {
    background:       palette.black,
    surface:          palette.card,
    surface2:         palette.card2,
    border:           palette.border,
    foreground:       palette.white,
    muted:            palette.muted,
    mutedForeground:  palette.muted2,
    primary:          palette.accent,
    accent:           palette.accent,
    bull:             palette.bull,
    bear:             palette.bear,
    neutral:          palette.neutral,
    ai:               palette.ai,
    info:             palette.info,
    tabBar:           '#0a0a0a',
    radius:           14,
    radiusSm:         10,
    radiusLg:         20,
  },
};

export type ColorScheme = typeof colors.dark;
