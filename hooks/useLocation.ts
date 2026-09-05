import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { getLocationHistoryPrivacy, saveLocationHistory, saveLocationHistoryPrivacy } from '../services/locationHistoryService';
import { isSharingEnabled, toggleLocationSharing, updateMyLocation } from '../services/locationService';
import { useCurrentUser } from './useCurrentUser';

const KEYS = {
  IS_SHARING: 'bump_is_sharing',
  SAVE_HISTORY: 'bump_save_history',
};

const getUserSettingKey = (key: string, userId: string) => `${key}.${userId}`;

type LocationContextValue = {
  location: Location.LocationObject | null;
  errorMsg: string | null;
  settingsLoaded: boolean;
  retryLocation: () => void;
  isSharing: boolean;
  setIsSharing: (value: boolean) => Promise<void>;
  saveHistory: boolean;
  setSaveHistory: (value: boolean) => Promise<void>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: React.PropsWithChildren) {
  const { currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  const pathname = usePathname();
  const publicRoutes = ['/', '/intro', '/login', '/register', '/verify-otp', '/forgot-password', '/maintenance', '/banned'];
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSharing, setIsSharingState] = useState(false);
  const [saveHistory, setSaveHistoryState] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const isSharingRef = useRef(false);
  const saveHistoryRef = useRef(false);
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));
  const needsLocationForScreen = ['/map', '/radar', '/camera'].some(
    route => pathname === route || pathname.startsWith(`${route}/`),
  );
  const shouldTrack = Boolean(userId)
    && !isPublicRoute
    && (isSharing || saveHistory || needsLocationForScreen);

  useEffect(() => { isSharingRef.current = isSharing; }, [isSharing]);
  useEffect(() => { saveHistoryRef.current = saveHistory; }, [saveHistory]);

  useEffect(() => {
    if (!userId) {
      setSettingsLoaded(false);
      setLocation(null);
      return;
    }
    let active = true;
    const loadSettings = async () => {
      const sharingKey = getUserSettingKey(KEYS.IS_SHARING, userId);
      const historyKey = getUserSettingKey(KEYS.SAVE_HISTORY, userId);
      const [storedSharing, storedHistory, legacySharing, legacyHistory] = await Promise.all([
        SecureStore.getItemAsync(sharingKey),
        SecureStore.getItemAsync(historyKey),
        SecureStore.getItemAsync(KEYS.IS_SHARING),
        SecureStore.getItemAsync(KEYS.SAVE_HISTORY),
      ]);
      const localSharing = storedSharing ?? legacySharing;
      const localHistory = storedHistory ?? legacyHistory;
      let sharing = localSharing === 'true';
      let history = localHistory === 'true';
      try {
        const dbSharing = await isSharingEnabled();
        if (dbSharing === null) await toggleLocationSharing(sharing);
        else sharing = dbSharing;
      } catch {}
      try {
        const dbHistory = await getLocationHistoryPrivacy();
        if (dbHistory === null) await saveLocationHistoryPrivacy(history);
        else history = dbHistory;
      } catch {}
      await Promise.all([
        SecureStore.setItemAsync(sharingKey, String(sharing)),
        SecureStore.setItemAsync(historyKey, String(history)),
      ]);
      if (active) {
        setIsSharingState(sharing);
        setSaveHistoryState(history);
        isSharingRef.current = sharing;
        saveHistoryRef.current = history;
        setSettingsLoaded(true);
      }
    };
    loadSettings().catch(error => {
      console.warn('[location] Cannot load settings:', error?.message || error);
      if (active) setSettingsLoaded(true);
    });
    return () => { active = false; };
  }, [userId]);

  const setIsSharing = useCallback(async (value: boolean) => {
    const previous = isSharingRef.current;
    setIsSharingState(value);
    isSharingRef.current = value;
    try {
      if (value) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Cần cấp quyền vị trí để bật chia sẻ');
      }
      await toggleLocationSharing(value);
      if (!userId) throw new Error('Chưa đăng nhập');
      await SecureStore.setItemAsync(getUserSettingKey(KEYS.IS_SHARING, userId), String(value));
    } catch (error) {
      setIsSharingState(previous);
      isSharingRef.current = previous;
      throw error;
    }
  }, [userId]);

  const setSaveHistory = useCallback(async (value: boolean) => {
    const previous = saveHistoryRef.current;
    setSaveHistoryState(value);
    saveHistoryRef.current = value;
    try {
      if (value) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Cần cấp quyền vị trí để lưu lịch sử');
      }
      await saveLocationHistoryPrivacy(value);
      if (!userId) throw new Error('Chưa đăng nhập');
      await SecureStore.setItemAsync(getUserSettingKey(KEYS.SAVE_HISTORY, userId), String(value));
    } catch (error) {
      setSaveHistoryState(previous);
      saveHistoryRef.current = previous;
      throw error;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !settingsLoaded || !shouldTrack) return;
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const processLocation = (nextLocation: Location.LocationObject) => {
      if (active) setLocation(nextLocation);
      if (isSharingRef.current) {
        updateMyLocation(nextLocation.coords.latitude, nextLocation.coords.longitude).catch(console.warn);
      }
      if (saveHistoryRef.current) {
        saveLocationHistory(nextLocation.coords.latitude, nextLocation.coords.longitude).catch(console.warn);
      }
    };

    const startWatching = async () => {
      setErrorMsg(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (active) setErrorMsg('Quyền truy cập vị trí bị từ chối');
        return;
      }
      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .catch(() => Location.getLastKnownPositionAsync());
        if (!current) {
          if (active) setErrorMsg('Không lấy được vị trí từ GPS');
          return;
        }
        processLocation(current);
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 15_000, distanceInterval: 10 },
          processLocation,
        );
      } catch (error) {
        console.warn('[location] GPS failed:', error);
        if (active) setErrorMsg('Thiết bị chưa bật định vị GPS');
      }
    };
    void startWatching();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [retryCount, settingsLoaded, shouldTrack, userId]);

  const retryLocation = useCallback(() => setRetryCount(value => value + 1), []);

  return React.createElement(
    LocationContext.Provider,
    { value: {
      location, errorMsg, settingsLoaded, retryLocation,
      isSharing, setIsSharing, saveHistory, setSaveHistory,
    } },
    children,
  );
}

export const useLocation = (): LocationContextValue => {
  const value = useContext(LocationContext);
  if (!value) throw new Error('useLocation must be used inside LocationProvider');
  return value;
};
