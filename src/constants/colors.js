export const COLORS = {
  // Primary greens
  primaryDark: '#1B5E20',
  primary: '#2E7D32',
  primaryLight: '#43A047',
  primaryLighter: '#66BB6A',
  primaryBg: '#E8F5E9',
  primaryMuted: '#A5D6A7',

  // Accent
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  gold: '#D4A017',

  // Reds
  red: '#EF4444',
  redLight: '#FEE2E2',
  redBg: '#FEF2F2',
  coral: '#F87171',

  // Blues
  blue: '#3B82F6',
  blueLight: '#DBEAFE',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  dark: '#111827',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textLight: '#D1D5DB',

  // Backgrounds
  background: '#F3F4F6',
  backgroundLight: '#F9FAFB',
  cardBg: '#FFFFFF',
  
  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#E5E7EB',

  // Shadows
  shadow: '#000000',

  // Tab bar
  tabActive: '#2E7D32',
  tabInactive: '#9CA3AF',

  // Match card
  matchBg: '#F0F7F0',

  // Event card overlay
  eventOverlay: 'rgba(27, 94, 32, 0.85)',

  // Transparent
  transparent: 'transparent',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
};

export const SIZES = {
  // Global sizes
  base: 8,
  font: 14,
  radius: 12,
  radiusSm: 8,
  radiusLg: 16,
  radiusXl: 20,
  padding: 16,
  paddingSm: 12,
  paddingLg: 20,
  paddingXl: 24,

  // Font sizes
  h1: 28,
  h2: 24,
  h3: 20,
  h4: 18,
  h5: 16,
  body: 14,
  caption: 12,
  small: 11,
  tiny: 10,

  // App dimensions
  tabBarHeight: 60,
  headerHeight: 56,
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
};

export default { COLORS, FONTS, SIZES, SHADOWS };
