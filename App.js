import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { ClubProvider } from './src/contexts/ClubContext';
import { CartProvider } from './src/contexts/CartContext';
import { UpdatesProvider } from './src/contexts/UpdatesContext';
import { UISettingsProvider, useUISettings } from './src/contexts/UISettingsContext';
import AppNavigator from './src/navigation/AppNavigator';

// Inject custom CSS styles directly for Web environments
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0B1220;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    /* Custom scrollbars matching the brand */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(16, 139, 81, 0.35);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(16, 139, 81, 0.6);
    }
  `;
  document.head.appendChild(style);
}

function AppShell() {
  const { settings } = useUISettings();
  const isDark = !!settings.darkMode;
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width > 768;

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: isDark ? '#0B1220' : '#F3F4F6',
      alignItems: 'center',
    }}>
      <View style={{
        flex: 1,
        width: '100%',
        maxWidth: isDesktop ? 1200 : '100%',
        backgroundColor: isDark ? '#0B1220' : '#F3F4F6',
      }}>
        <AppNavigator />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UpdatesProvider>
          <UISettingsProvider>
            <AuthProvider>
              <ClubProvider>
                <CartProvider>
                  <AppShell />
                </CartProvider>
              </ClubProvider>
            </AuthProvider>
          </UISettingsProvider>
        </UpdatesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
