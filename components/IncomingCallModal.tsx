import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import {
  CallSession,
  getPendingIncomingCall,
  respondToCall,
  subscribeToCall,
  subscribeToIncomingCalls,
} from '../services/callService';
import { getPublicProfiles, PublicProfile } from '../services/profileDirectoryService';
import { Colors } from '../styles/colors';

type Props = { userId?: string };

export default function IncomingCallModal({ userId }: Props) {
  const router = useRouter();
  const [call, setCall] = useState<CallSession | null>(null);
  const [caller, setCaller] = useState<PublicProfile | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    getPendingIncomingCall(userId)
      .then(pending => { if (active && pending) setCall(pending); })
      .catch(error => console.warn('[call] Cannot load pending call:', error?.message || error));

    const unsubscribe = subscribeToIncomingCalls(userId, incoming => {
      if (incoming.status === 'ringing') setCall(incoming);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!call) {
      setCaller(null);
      Vibration.cancel();
      return;
    }

    Vibration.vibrate([0, 500, 900], true);
    getPublicProfiles([call.caller_id])
      .then(profiles => setCaller(profiles[0] || null))
      .catch(() => setCaller(null));

    const unsubscribe = subscribeToCall(call.id, updated => {
      if (updated.status !== 'ringing') setCall(null);
    });
    return () => {
      Vibration.cancel();
      unsubscribe();
    };
  }, [call]);

  const handleResponse = async (accept: boolean) => {
    if (!call || responding) return;
    setResponding(true);
    try {
      const updated = await respondToCall(call.id, accept);
      setCall(null);
      if (accept) {
        router.push({
          pathname: '/call',
          params: {
            callId: updated.id,
            name: caller?.name || caller?.username || 'Người dùng Tibro',
            avatar: caller?.avatar || '',
            isVideo: updated.is_video ? '1' : '0',
            outgoing: '0',
          },
        } as any);
      }
    } catch (error: any) {
      setCall(null);
      Alert.alert('Cuộc gọi đã kết thúc', error?.message || 'Không thể phản hồi cuộc gọi.');
    } finally {
      setResponding(false);
    }
  };

  return (
    <Modal visible={Boolean(call)} transparent animationType="fade" onRequestClose={() => handleResponse(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {caller?.avatar ? (
            <Image source={{ uri: caller.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Feather name="user" size={42} color={Colors.primary} />
            </View>
          )}
          <Text style={styles.name}>{caller?.name || caller?.username || 'Người dùng Tibro'}</Text>
          <Text style={styles.subtitle}>
            {call?.is_video ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityLabel="Từ chối cuộc gọi"
              style={[styles.action, styles.decline]}
              onPress={() => handleResponse(false)}
              disabled={responding}
            >
              <Feather name="phone-off" size={28} color="#fff" />
              <Text style={styles.actionLabel}>Từ chối</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Chấp nhận cuộc gọi"
              style={[styles.action, styles.accept]}
              onPress={() => handleResponse(true)}
              disabled={responding}
            >
              {responding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Feather name={call?.is_video ? 'video' : 'phone'} size={28} color="#fff" />
              )}
              <Text style={styles.actionLabel}>Nghe máy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderRadius: 28,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  avatar: { width: 108, height: 108, borderRadius: 54, marginBottom: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight },
  name: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: 15, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 52, marginTop: 38 },
  action: { alignItems: 'center', justifyContent: 'center', width: 82, height: 82, borderRadius: 41 },
  decline: { backgroundColor: '#EF4444' },
  accept: { backgroundColor: '#22C55E' },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
});
