import React, { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import { showToast } from '../utils/toast';

export const UpdatesContext = React.createContext();

export function UpdatesProvider({ children }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!__DEV__) {
      checkForUpdates({ silentIfUpToDate: true });
    }
  }, []);

  const checkForUpdates = async ({ silentIfUpToDate = false } = {}) => {
    if (isChecking) return;
    
    try {
      setIsChecking(true);
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        setUpdateAvailable(true);
        showToast('Update found. Downloading now...');
        const result = await Updates.fetchUpdateAsync();
        if (result?.isNew) {
          showToast('Update downloaded. Restarting app...');
          await Updates.reloadAsync();
          return;
        }
        showToast('Update downloaded. Please reopen app.');
      } else if (!silentIfUpToDate) {
        showToast('App is already up to date.');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      showToast('Update check failed. Using installed version.');
    } finally {
      setIsChecking(false);
    }
  };

  const value = {
    updateAvailable,
    isChecking,
    checkForUpdates,
  };

  return (
    <UpdatesContext.Provider value={value}>
      {children}
    </UpdatesContext.Provider>
  );
}

export function useUpdates() {
  const context = React.useContext(UpdatesContext);
  if (!context) {
    throw new Error('useUpdates must be used within an UpdatesProvider');
  }
  return context;
}
