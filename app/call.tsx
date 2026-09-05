import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Track } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CallCredentials,
  CallStatus,
  endCall,
  getCallCredentials,
  subscribeToCall,
} from '../services/callService';
import { Colors } from '../styles/colors';
import {
  getLiveKitNativeModule,
  type LiveKitNativeModule,
} from '../utils/registerLiveKitGlobals';

type RoomContentProps = {
  liveKit: LiveKitNativeModule;
  isVideo: boolean;
  name: string;
  avatar?: string;
  status: CallStatus;
  onHangup: () => void;
};

function RoomContent({ liveKit, isVideo, name, avatar, status, onHangup }: RoomContentProps) {
  const { VideoTrack, useLocalParticipant, useTracks } = liveKit;
  const cameraTracks = useTracks([Track.Source.Camera]);
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const remoteTrack = cameraTracks.find(track => !track.participant.isLocal);
  const localTrack = cameraTracks.find(track => track.participant.isLocal);

  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(error => {
      Alert.alert('Không thể dùng micro', error?.message || 'Vui lòng kiểm tra quyền micro.');
    });
  };

  const toggleCamera = () => {
    localParticipant.setCameraEnabled(!isCameraEnabled).catch(error => {
      Alert.alert('Không thể dùng camera', error?.message || 'Vui lòng kiểm tra quyền camera.');
    });
  };

  return (
    <View style={styles.room}>
      {isVideo && remoteTrack ? (
        <VideoTrack trackRef={remoteTrack} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.voiceStage}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Feather name="user" size={54} color={Colors.primary} />
            </View>
          )}
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.status}>
            {status === 'ringing' ? 'Đang đổ chuông…' : 'Đã kết nối'}
          </Text>
        </View>
      )}

      {isVideo && localTrack && isCameraEnabled ? (
        <VideoTrack
          trackRef={localTrack}
          style={styles.localVideo}
          objectFit="cover"
          mirror
          zOrder={1}
        />
      ) : null}

      {isVideo && remoteTrack ? (
        <View style={styles.videoTitle}>
          <Text style={styles.videoName}>{name}</Text>
          <Text style={styles.videoStatus}>{status === 'ringing' ? 'Đang đổ chuông…' : 'Đã kết nối'}</Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        <TouchableOpacity
          accessibilityLabel={isMicrophoneEnabled ? 'Tắt micro' : 'Bật micro'}
          style={[styles.control, !isMicrophoneEnabled && styles.controlDisabled]}
          onPress={toggleMic}
        >
          <Feather name={isMicrophoneEnabled ? 'mic' : 'mic-off'} size={25} color="#fff" />
        </TouchableOpacity>
        {isVideo ? (
          <TouchableOpacity
            accessibilityLabel={isCameraEnabled ? 'Tắt camera' : 'Bật camera'}
            style={[styles.control, !isCameraEnabled && styles.controlDisabled]}
            onPress={toggleCamera}
          >
            <Feather name={isCameraEnabled ? 'video' : 'video-off'} size={25} color="#fff" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityLabel="Kết thúc cuộc gọi" style={styles.hangup} onPress={onHangup}>
          <Feather name="phone-off" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UnsupportedCallScreen() {
  const router = useRouter();
  const message = Platform.OS === 'web'
    ? 'Cuộc gọi thoại và video hiện được hỗ trợ trên ứng dụng Android/iOS.'
    : 'Expo Go không tích hợp WebRTC của LiveKit. Hãy mở Tibro bằng development build để thử cuộc gọi.';

  return (
    <SafeAreaView style={styles.loading}>
      <Feather name="video-off" size={44} color={Colors.primary} />
      <Text style={styles.unsupportedTitle}>Chưa thể mở cuộc gọi</Text>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Quay lại</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

export default function CallScreen() {
  const liveKit = getLiveKitNativeModule();
  if (!liveKit) return <UnsupportedCallScreen />;
  return <NativeCallScreen liveKit={liveKit} />;
}

function NativeCallScreen({ liveKit }: { liveKit: LiveKitNativeModule }) {
  const { LiveKitRoom } = liveKit;
  const router = useRouter();
  const params = useLocalSearchParams();
  const callId = Array.isArray(params.callId) ? params.callId[0] : params.callId;
  const nameParam = Array.isArray(params.name) ? params.name[0] : params.name;
  const avatarParam = Array.isArray(params.avatar) ? params.avatar[0] : params.avatar;
  const isVideoParam = Array.isArray(params.isVideo) ? params.isVideo[0] : params.isVideo;
  const outgoingParam = Array.isArray(params.outgoing) ? params.outgoing[0] : params.outgoing;
  const isVideo = isVideoParam === '1';
  const outgoing = outgoingParam === '1';
  const [credentials, setCredentials] = useState<CallCredentials | null>(null);
  const [status, setStatus] = useState<CallStatus>(outgoing ? 'ringing' : 'accepted');
  const [error, setError] = useState('');
  const endingRef = useRef(false);

  const leave = useCallback(async (reason?: 'cancelled' | 'missed') => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      if (callId) await endCall(callId, reason);
    } catch (leaveError) {
      console.warn('[call] End failed:', leaveError);
    } finally {
      router.back();
    }
  }, [callId, router]);

  const terminateFailedCall = useCallback(async (message: string) => {
    setError(message);
    if (!callId || endingRef.current) return;
    endingRef.current = true;
    try {
      await endCall(callId, outgoing && status === 'ringing' ? 'cancelled' : undefined);
    } catch (endError) {
      console.warn('[call] Cleanup after connection failure failed:', endError);
    }
  }, [callId, outgoing, status]);

  useEffect(() => {
    if (!callId) {
      setError('Thiếu mã cuộc gọi.');
      return;
    }

    let active = true;
    getCallCredentials(callId)
      .then(value => { if (active) setCredentials(value); })
      .catch(loadError => {
        if (active) void terminateFailedCall(loadError?.message || 'Không thể kết nối cuộc gọi.');
      });

    const unsubscribe = subscribeToCall(callId, updated => {
      setStatus(updated.status);
      if (['declined', 'cancelled', 'ended', 'missed'].includes(updated.status)) {
        endingRef.current = true;
        const message: Partial<Record<CallStatus, string>> = {
          declined: 'Người nhận đã từ chối cuộc gọi.',
          cancelled: 'Cuộc gọi đã bị hủy.',
          ended: 'Cuộc gọi đã kết thúc.',
          missed: 'Không có người trả lời.',
        };
        Alert.alert('Cuộc gọi', message[updated.status], [{ text: 'Đóng', onPress: () => router.back() }]);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [callId, router, terminateFailedCall]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (error) router.back();
      else void leave(status === 'ringing' ? 'cancelled' : undefined);
      return true;
    });
    return () => subscription.remove();
  }, [error, leave, router, status]);

  useEffect(() => {
    if (!outgoing || status !== 'ringing' || !callId) return;
    const timer = setTimeout(() => { void leave('missed'); }, 45_000);
    return () => clearTimeout(timer);
  }, [callId, leave, outgoing, status]);

  if (error) {
    return (
      <SafeAreaView style={styles.loading}>
        <Feather name="alert-circle" size={44} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!credentials) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Đang kết nối cuộc gọi…</Text>
      </SafeAreaView>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={credentials.server_url}
      token={credentials.participant_token}
      connect
      audio
      video={isVideo}
      onError={roomError => {
        void terminateFailedCall(roomError.message || 'Không thể kết nối phòng gọi.');
      }}
      onDisconnected={() => {
        if (!endingRef.current) void leave();
      }}
    >
      <RoomContent
        liveKit={liveKit}
        isVideo={isVideo}
        name={nameParam || 'Người dùng Tibro'}
        avatar={avatarParam || undefined}
        status={status}
        onHangup={() => void leave(status === 'ringing' ? 'cancelled' : undefined)}
      />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: '#070A12' },
  remoteVideo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  localVideo: {
    position: 'absolute',
    top: 64,
    right: 18,
    width: 112,
    height: 164,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  voiceStage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  avatar: { width: 132, height: 132, borderRadius: 66, marginBottom: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight },
  name: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  status: { color: Colors.textSecondary, fontSize: 16, marginTop: 9 },
  videoTitle: { position: 'absolute', top: 64, left: 20, right: 146 },
  videoName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  videoStatus: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  control: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(55,65,81,0.9)' },
  controlDisabled: { backgroundColor: '#DC2626' },
  hangup: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28, backgroundColor: Colors.black },
  loadingText: { color: Colors.textSecondary, fontSize: 16 },
  unsupportedTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  errorText: { color: Colors.textPrimary, fontSize: 16, textAlign: 'center' },
  backButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backButtonText: { color: '#fff', fontWeight: '700' },
});
