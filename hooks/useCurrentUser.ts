import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { clearLocalAuthState, logoutUser } from '../services/authService';
import { UserProfile } from '../services/friendService';
import { updateOnlineStatus } from '../services/profileService';
import { supabase } from '../services/supabaseConfig';
import { getSessionToken } from '../utils/storage';

type CurrentUserContextValue = {
  currentUser: UserProfile | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: React.PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef(AppState.currentState);
  const mismatchAlertVisible = useRef(false);
  const router = useRouter();

  const checkSessionToken = useCallback(async (serverToken?: string) => {
    if (!serverToken || mismatchAlertVisible.current) return;
    const localToken = await getSessionToken();
    if (!localToken || serverToken === localToken) return;

    mismatchAlertVisible.current = true;
    Alert.alert(
      'Đăng nhập ở nơi khác',
      'Tài khoản của bạn vừa được đăng nhập ở một thiết bị khác. Máy này sẽ tự động đăng xuất.',
      [{
        text: 'OK',
        onPress: async () => {
          await logoutUser();
          mismatchAlertVisible.current = false;
          router.replace('/login' as any);
        },
      }],
    );
  }, [router]);

  const refetch = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (error) throw error;
    setCurrentUser(data as UserProfile);
    await checkSessionToken(data.session_token);
    setLoading(false);
  }, [checkSessionToken]);

  useEffect(() => {
    let active = true;
    refetch().catch(error => {
      if (active) {
        console.warn('[current-user] Cannot load profile:', error?.message || error);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      setTimeout(() => {
        if (active) void refetch().catch(console.warn);
      }, 0);
    });

    const validateSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return;
      if (error && error.status !== 401 && error.status !== 403) return;
      await clearLocalAuthState();
      setCurrentUser(null);
      router.replace('/login' as any);
    };

    const pingStatus = () => {
      if (AppState.currentState === 'active') updateOnlineStatus().catch(() => {});
    };
    const pingInterval = setInterval(pingStatus, 60_000);
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState === 'active') {
        void validateSession();
        pingStatus();
      } else if (previousState === 'active') {
        updateOnlineStatus().catch(() => {});
      }
    });

    return () => {
      active = false;
      clearInterval(pingInterval);
      appStateSubscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, [refetch, router]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel(`current-user-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` },
        payload => {
          const updated = payload.new as UserProfile & { session_token?: string };
          setCurrentUser(updated);
          void checkSessionToken(updated.session_token);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [checkSessionToken, currentUser?.id]);

  return React.createElement(
    CurrentUserContext.Provider,
    { value: { currentUser, loading, refetch } },
    children,
  );
}

export const useCurrentUser = (): CurrentUserContextValue => {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  return value;
};
