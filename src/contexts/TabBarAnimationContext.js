import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { useUISettings } from "./UISettingsContext";

const TabBarAnimationContext = createContext(null);

export function TabBarAnimationProvider({ children }) {
  const collapsed = useSharedValue(0);
  const { settings } = useUISettings();
  const reduceMotion = !!settings.reduceMotion;

  const setCollapsed = useCallback((nextCollapsed) => {
    if (reduceMotion) {
      collapsed.value = nextCollapsed ? 1 : 0;
      return;
    }

    collapsed.value = withSpring(nextCollapsed ? 1 : 0, {
      damping: 18,
      stiffness: 140,
      mass: 0.8,
    });
  }, [reduceMotion]);

  const value = useMemo(
    () => ({ collapsed, setCollapsed }),
    [collapsed, setCollapsed],
  );

  return (
    <TabBarAnimationContext.Provider value={value}>
      {children}
    </TabBarAnimationContext.Provider>
  );
}

export const useTabBarAnimation = () => {
  const ctx = useContext(TabBarAnimationContext);
  if (!ctx) {
    throw new Error("useTabBarAnimation must be used within TabBarAnimationProvider");
  }
  return ctx;
};