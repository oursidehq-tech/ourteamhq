export const theme = {
  colors: {
    primary: '#108B51', // Green from the mockups
    secondary: '#E6F4ED', // Light green background for some tags
    background: '#F9F9F9', // App background
    surface: '#FFFFFF', // Card background
    text: '#1C1C1E',
    textSecondary: '#8E8E93',
    border: '#E5E5EA',
    error: '#FF3B30',
    success: '#34C759',
    white: '#FFFFFF',
    transparent: 'transparent',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  radius: {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700', color: '#1C1C1E' },
    h2: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
    h3: { fontSize: 20, fontWeight: '600', color: '#1C1C1E' },
    h4: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
    body: { fontSize: 16, fontWeight: '400', color: '#1C1C1E' },
    caption: { fontSize: 14, fontWeight: '400', color: '#8E8E93' },
    small: { fontSize: 12, fontWeight: '400', color: '#8E8E93' },
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};
