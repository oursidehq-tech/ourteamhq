import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "greensports.settings.v1";

const DEFAULT_SETTINGS = {
  darkMode: false,
  reduceMotion: false,
  compactMode: false,
};

const UISettingsContext = createContext(null);

export function UISettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // Keep defaults if parsing fails.
      } finally {
        if (mounted) setLoaded(true);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const updateSetting = async (key, value) => {
    let nextState = null;
    setSettings((prev) => {
      nextState = { ...prev, [key]: value };
      return nextState;
    });

    try {
      if (nextState) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      }
    } catch {
      // Ignore write failures to avoid blocking UI toggles.
    }
  };

  const value = useMemo(
    () => ({ settings, loaded, updateSetting }),
    [settings, loaded],
  );

  return (
    <UISettingsContext.Provider value={value}>
      {children}
    </UISettingsContext.Provider>
  );
}

export const useUISettings = () => {
  const ctx = useContext(UISettingsContext);
  if (!ctx) {
    throw new Error("useUISettings must be used within UISettingsProvider");
  }
  return ctx;
};
