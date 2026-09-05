// =========================================================
// app/chat/settings/[id].tsx
// Cài đặt cuộc trò chuyện — Giao diện giống Messenger
// =========================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Switch, TextInput, Alert, Dimensions, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../../styles/colors';
import { supabase } from '../../../services/supabaseConfig';
import { getSharedPhotos, updateNickname, toggleMute, clearChatHistory } from '../../../services/chatService';
import ReportModal from '../../../components/ReportModal';

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_COL = 3;
const PHOTO_GAP = 2;
const PHOTO_SIZE = (SCREEN_W - 32 - PHOTO_GAP * (PHOTO_COL - 1)) / PHOTO_COL;

type SettingRowProps = {
  icon: string;
  label: string;
  iconBg: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  borderBottom?: boolean;
};

const SettingRow = ({
  icon, label, iconBg, onPress, trailing, borderBottom = true,
}: SettingRowProps) => (
  <TouchableOpacity
    style={[styles.settingRow, !borderBottom && { borderBottomWidth: 0 }]}
    onPress={onPress}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
  >
    <View style={[styles.settingRowIcon, { backgroundColor: iconBg }]}>
      <Feather name={icon as any} size={18} color="#fff" />
    </View>
    <Text style={styles.settingRowLabel}>{label}</Text>
    {trailing ?? <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.2)" />}
  </TouchableOpacity>
);

export default function ChatSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const avatar = Array.isArray(params.avatar) ? params.avatar[0] : params.avatar;
  const otherUserId = Array.isArray(params.otherUserId) ? params.otherUserId[0] : params.otherUserId;

  const [isMuted, setIsMuted] = useState(false);
  const [nickname, setNickname] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [sharedPhotos, setSharedPhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [resolvedOtherUserId, setResolvedOtherUserId] = useState(otherUserId || '');

  const loadSettings = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const myId = session.user.id;

      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single();

      if (conv) {
        const isUser1 = conv.user1_id === myId;
        const nick = isUser1 ? (conv.user1_nickname || '') : (conv.user2_nickname || '');
        setNickname(nick);
        setNicknameInput(nick);
        setIsMuted(isUser1 ? (conv.user1_mute || false) : (conv.user2_mute || false));

        // Tìm otherUserId nếu chưa có
        const otherId = isUser1 ? conv.user2_id : conv.user1_id;
        if (otherId) setResolvedOtherUserId(previous => previous || otherId);
      }
    } catch (e) {
      console.error('Load settings error:', e);
    }
  }, [id]);

  const loadPhotos = useCallback(async () => {
    try {
      const photos = await getSharedPhotos(id);
      setSharedPhotos(photos);
    } catch (e) {
      console.error('Load photos error:', e);
    } finally {
      setLoadingPhotos(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadSettings();
      loadPhotos();
    }
  }, [id, loadPhotos, loadSettings]);

  const handleSaveNickname = async () => {
    try {
      await updateNickname(id, nicknameInput.trim());
      setNickname(nicknameInput.trim());
      setIsEditingNickname(false);
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật biệt danh');
    }
  };

  const handleToggleMute = async (value: boolean) => {
    setIsMuted(value);
    try {
      await toggleMute(id, value);
    } catch {
      setIsMuted(!value);
      Alert.alert('Lỗi', 'Không thể thay đổi cài đặt thông báo');
    }
  };

  const handleDeleteChat = () => {
    Alert.alert(
      'Xóa lịch sử chat',
      'Bạn có chắc muốn xóa toàn bộ tin nhắn? Hành động này không thể hoàn tác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearChatHistory(id as string);
              Alert.alert('Thành công', 'Lịch sử chat đã được làm trống!', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/chat' as any) }
              ]);
            } catch (e: any) {
              Alert.alert('Lỗi', e.message || 'Không thể xóa lịch sử chat');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ====== Profile Card ====== */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRing}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{nickname || name}</Text>
          {nickname ? (
            <Text style={styles.profileSubtitle}>{name}</Text>
          ) : null}
        </View>


        {/* ====== Tùy chỉnh ====== */}
        <Text style={styles.sectionLabel}>Tùy chỉnh</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon="edit-3"
            label={nickname ? `Biệt danh: ${nickname}` : 'Đặt biệt danh'}
            iconBg="#FF9500"
            borderBottom={false}
            onPress={() => {
              setNicknameInput(nickname);
              setIsEditingNickname(true);
            }}
          />
        </View>

        {/* ====== Thêm ====== */}
        <Text style={styles.sectionLabel}>Thêm</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={isMuted ? 'bell-off' : 'bell'}
            label={isMuted ? 'Đã tắt thông báo' : 'Thông báo'}
            iconBg={isMuted ? '#FF3B30' : '#34C759'}
            borderBottom={false}
            trailing={
              <Switch
                value={isMuted}
                onValueChange={handleToggleMute}
                trackColor={{ false: '#3a3a3c', true: Colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* ====== Ảnh đã gửi ====== */}
        <View style={styles.photosSection}>
          <View style={styles.photosSectionHeader}>
            <Text style={styles.sectionLabel2}>Ảnh đã chia sẻ</Text>
            <Text style={styles.photosCount}>
              {loadingPhotos ? '...' : `${sharedPhotos.length}`}
            </Text>
          </View>

          {loadingPhotos ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 40 }} />
          ) : sharedPhotos.length === 0 ? (
            <View style={styles.emptyPhotos}>
              <View style={styles.emptyIconCircle}>
                <Feather name="image" size={32} color="rgba(255,255,255,0.15)" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có ảnh nào</Text>
              <Text style={styles.emptyDesc}>Ảnh các bạn gửi cho nhau sẽ hiển thị ở đây</Text>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {sharedPhotos.slice(0, 9).map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.85}
                  style={styles.photoWrapper}
                  onPress={() => setPreviewImage(photo)}
                >
                  <Image source={{ uri: photo }} style={styles.sharedPhoto} />
                  {/* Overlay "Xem tất cả" nếu là ảnh cuối + có > 9 ảnh */}
                  {index === 8 && sharedPhotos.length > 9 && (
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoOverlayText}>+{sharedPhotos.length - 9}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ====== Quyền riêng tư & Hỗ trợ ====== */}
        <Text style={styles.sectionLabel}>Quyền riêng tư & Hỗ trợ</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon="trash-2"
            label="Xóa lịch sử chat"
            iconBg="#FF3B30"
            onPress={handleDeleteChat}
          />
          <SettingRow
            icon="alert-triangle"
            label="Báo cáo người dùng"
            iconBg="#FF9500"
            onPress={() => setShowReportModal(true)}
            borderBottom={false}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ====== Nickname Modal ====== */}
      <Modal visible={isEditingNickname} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đặt biệt danh</Text>
            <Text style={styles.modalDesc}>Biệt danh chỉ hiển thị trong cuộc trò chuyện này</Text>
            <TextInput
              style={styles.modalInput}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="Nhập biệt danh..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
              maxLength={30}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditingNickname(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !nicknameInput.trim() && { opacity: 0.4 }]}
                onPress={handleSaveNickname}
              >
                <Text style={styles.modalSaveText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ====== Image Preview Modal ====== */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={[styles.previewClose, { top: insets.top + 10 }]}
            onPress={() => setPreviewImage(null)}
          >
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* ====== Report Modal ====== */}
      <ReportModal
        visible={showReportModal}
        reportedUserId={resolvedOtherUserId}
        reportedUserName={name || ''}
        onClose={() => setShowReportModal(false)}
      />
    </View>
  );
}

// =========================================================
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 52,
  },
  backBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },

  scrollContent: {
    paddingBottom: 20,
  },

  // ---- Profile Card ----
  profileCard: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.primary,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  profileSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ---- Quick Actions ----
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  quickAction: {
    alignItems: 'center',
    width: 76,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99,102,241,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
  },

  // ---- Section ----
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },

  // ---- Setting Row ----
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  settingRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingRowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  // ---- Photos ----
  photosSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionLabel2: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  photosCount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sharedPhoto: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOverlayText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    opacity: 0.6,
  },

  // ---- Nickname Modal ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalSaveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // ---- Image Preview ----
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewClose: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  previewImage: {
    width: SCREEN_W - 32,
    height: SCREEN_W - 32,
    borderRadius: 16,
  },
});
