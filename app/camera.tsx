// =========================================================
// app/camera.tsx
// Màn hình chụp ảnh khoảnh khắc (Moment)
// =========================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../styles/colors';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import { postMoment, MomentData } from '../services/momentService';
import { sendReaction, subscribeToReactions, fetchReactionsWithUsers, ReactionWithUser } from '../services/momentReactionService';
import { supabase } from '../services/supabaseConfig';
import EmojiReaction from '../components/EmojiReaction';
import ReactionAvatars from '../components/ReactionAvatars';
import ReactionListModal from '../components/ReactionListModal';
import { getFriends, UserProfile } from '../services/friendService';
import { getOrCreateConversation } from '../services/chatService';

export default function CameraScreen() {
  const router = useRouter();
  const { momentsStr, initialIndex } = useLocalSearchParams<{ momentsStr?: string; initialIndex?: string }>();
  
  const parsedMoments = useMemo<MomentData[]>(() => {
    if (!momentsStr) return [];
    try {
      const parsed = JSON.parse(momentsStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [momentsStr]);
  
  const [mode, setMode] = useState<'view' | 'capture'>(parsedMoments.length > 0 ? 'view' : 'capture');
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex ? parseInt(initialIndex, 10) : 0);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getFriends().then(setFriends).catch(console.log);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('users').select('*').eq('id', data.user.id).single().then(res => {
          if (res.data) setMyProfile(res.data);
        });
      }
    });
  }, []);

  const filteredMoments = selectedUserId
    ? parsedMoments.filter(m => m.user_id === selectedUserId)
    : parsedMoments;

  const currentMoment = filteredMoments[currentIndex];
  const currentMomentId = currentMoment?.id;

  const handleNextMoment = () => {
    if (currentIndex < filteredMoments.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const handleSelectUser = (id: string | null) => {
    setSelectedUserId(id);
    setCurrentIndex(0);
    setShowDropdown(false);
  };

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionWithUser[]>([]);
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Safe area insets — dùng thủ công để layout nhất quán dù mở camera từ đâu
  const insets = useSafeAreaInsets();

  // Lấy ID của mình để check "You" vs "Bạn bè"
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setMyId(data.session?.user?.id || null);
    });
  }, []);

  // Subscribe to reactions on the current moment
  useEffect(() => {
    if (mode !== 'view' || !currentMomentId) return;
    const unsub = subscribeToReactions(currentMomentId, () => {
      // Reload danh sách reactions khi có reaction mới
      fetchReactionsWithUsers(currentMomentId).then(setReactions).catch(console.warn);
    });
    // Load ban đầu khi mở moment của chính mình
    fetchReactionsWithUsers(currentMomentId).then(setReactions).catch(console.warn);
    return () => unsub();
  }, [mode, currentMomentId]);

  const handleSendReaction = async (emoji: string) => {
    if (!currentMoment) return;
    try {
      await sendReaction(currentMoment.id, emoji);
    } catch (error: any) {
      Alert.alert('Không gửi được cảm xúc', error?.message || 'Vui lòng thử lại.');
    }
  };

  if (!permission) {
    return <View style={styles.container} />; // Loading permissions
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="chevron-left" size={28} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>Đội Giao Thông Cần Camera 📸</Text>
          <Text style={styles.subText}>Cấp quyền để chia sẻ khoảnh khắc với bạn bè rôm rả hơn nhé.</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
            <Text style={styles.btnText}>Cấp quyền Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Chụp ảnh
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          exif: false,
        });
        if (photo?.uri) {
          if (facing === 'front') {
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              photo.uri,
              [{ flip: ImageManipulator.FlipType.Horizontal }],
              { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );
            setPhotoUri(manipulatedImage.uri);
          } else {
            setPhotoUri(photo.uri);
          }
        }
      } catch {
        Alert.alert('Lỗi', 'Không thể chụp ảnh!');
      }
    }
  };

  const handlePost = async () => {
    if (!photoUri) return;
    setIsUploading(true);
    try {
      // Moment hiển thị trên bản đồ nên cần quyền vị trí foreground.
      let locationPermission = await Location.getForegroundPermissionsAsync();
      if (!locationPermission.granted) {
        locationPermission = await Location.requestForegroundPermissionsAsync();
      }
      if (!locationPermission.granted) {
        throw new Error('Cần cấp quyền vị trí để đăng khoảnh khắc lên bản đồ');
      }

      // 1. Lấy vị trí ngay lập tức
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      
      // 2. Upload
      await postMoment(photoUri, loc.coords.latitude, loc.coords.longitude, caption);
      
      Alert.alert('Thành công', 'Khoảnh khắc của bạn đã được đăng!', [
        { text: 'Xong', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.log('Post moment error:', error);
      Alert.alert('Lỗi đăng ảnh', error.message || 'Xin vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReply = async () => {
    if (isNavigating) return;
    if (!currentMoment || !currentMoment.user_id) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin khoảnh khắc');
      return;
    }

    setIsNavigating(true);

    try {
      const convId = await getOrCreateConversation(currentMoment.user_id);

      const friendName = currentMoment.user?.name || 'Bạn bè';
      const friendAvatar = currentMoment.user?.avatar || '';
      const imageUrl = currentMoment.image_url || '';

      // Đóng modal camera trước hoặc thay thế nó để màn hình chat hiện lên trên cùng
      router.replace({
        pathname: '/chat/[id]',
        params: {
          id: convId,
          name: friendName,
          avatar: friendAvatar,
          otherUserId: currentMoment.user_id,
          replyMomentUrl: imageUrl ? encodeURIComponent(imageUrl) : '',
        }
      });
    } catch (e: any) {
      Alert.alert('Không thể trả lời', e?.message || 'Không thể mở cuộc trò chuyện.');
    } finally {
      setIsNavigating(false);
    }
  };

  return (
    // Dùng View thường + absoluteFillObject thay vì SafeAreaView
    // để layout KHÔNG bị ảnh hưởng bởi context tab navigator khi mở từ Map
    <View style={styles.container}>

      {/* ===== HEADER ===== */}
      <View style={[styles.header, { paddingTop: insets.top + 8, height: 56 + insets.top }]}>
        <TouchableOpacity 
          onPress={() => photoUri ? setPhotoUri(null) : router.back()} 
          style={styles.iconBtn}
          disabled={isUploading}
        >
          <Feather name={photoUri ? "arrow-left" : "chevron-left"} size={28} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {mode === 'view' && (
            <TouchableOpacity style={styles.filterBtn} onPress={() => setShowDropdown(true)}>
              <Text style={styles.filterText}>
                {selectedUserId === null ? 'Mọi người' : (selectedUserId === myId ? 'Bạn' : friends.find(f => f.id === selectedUserId)?.name || 'Mọi người')}
              </Text>
              <Feather name={showDropdown ? "chevron-up" : "chevron-down"} size={16} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {mode === 'view' ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="x" size={24} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* ===== PHOTO BOX ===== */}
      <View style={styles.photoContainer}>
        <View style={styles.photoBox}>
          {mode === 'view' ? (
            currentMoment ? (
              <TouchableOpacity style={styles.fill} activeOpacity={1} onPress={handleNextMoment}>
                <Image source={{ uri: currentMoment.image_url }} style={styles.fill} contentFit="cover" />
                {currentMoment.caption && (
                  <View style={styles.captionBadgeDisplay}>
                    <Text style={styles.captionTextDisplay}>{currentMoment.caption}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.fill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E1E1E' }]}>
                <Feather name="image" size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '600' }}>Chưa có khoảnh khắc</Text>
              </View>
            )
          ) : photoUri ? (
            <View style={styles.fill}>
              <Image source={{ uri: photoUri }} style={styles.fill} contentFit="cover" />
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.captionInputContainer}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
              >
                <TextInput
                  style={styles.captionInput}
                  placeholder="Thêm chú thích..."
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={caption}
                  onChangeText={setCaption}
                  maxLength={50}
                  autoCorrect={false}
                />
              </KeyboardAvoidingView>
            </View>
          ) : (
            <CameraView 
              key={facing}
              ref={cameraRef} 
              style={styles.fill} 
              facing={facing} 
              animateShutter={true} 
            />
          )}
        </View>
      </View>

      {/* ===== INFO + ACTIVITY (chỉ hiện MODE VIEW) ===== */}
      {mode === 'view' && currentMoment && (
        <View style={styles.metaArea}>
          <View style={styles.userInfoArea}>
            <Text style={styles.infoName}>
              {myId === currentMoment.user_id ? 'You' : (currentMoment.user?.name || 'Bạn bè')}
            </Text>
            <Text style={styles.infoTime}>
              {new Date(currentMoment.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}
            </Text>
          </View>
          <View style={styles.activityArea}>
            {myId === currentMoment.user_id ? (
              // === XEM MOMENT CỦA MÌNH: Hiện avatar người đã react ===
              <ReactionAvatars
                reactions={reactions}
                onPress={() => setShowReactionModal(true)}
              />
            ) : (
              // === XEM MOMENT NGƯỜI KHÁC: Giữ nguyên ===
              <EmojiReaction onReaction={handleSendReaction} />
            )}
          </View>
        </View>
      )}

      {/* ===== FOOTER (cùng vị trí, cùng chiều cao cả 2 mode) ===== */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {mode === 'view' ? (
          // Footer cho mode VIEW: camera btn (chụp phản hồi) + reply btn
          <View style={styles.footerRow}>
            <View style={styles.footerSide} />
            <TouchableOpacity style={styles.captureOuter} onPress={() => setMode('capture')}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <View style={styles.footerSide}>
              {/* Chỉ show nút khi myId đã load VÀ đây không phải moment của mình */}
              {myId !== null && myId !== currentMoment?.user_id && (
                <TouchableOpacity 
                  style={styles.replyBtn} 
                  onPress={handleReply}
                  activeOpacity={0.7}
                >
                  <Feather name="message-circle" size={26} color={Colors.white} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : photoUri ? (
          // Footer cho mode PREVIEW: Chụp lại + Đăng
          <View style={styles.previewControls}>
            <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.cancelBtn} disabled={isUploading}>
              <Text style={styles.cancelText}>Chụp lại</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePost} style={styles.postBtn} disabled={isUploading}>
              {isUploading ? (
                <ActivityIndicator size="small" color={Colors.white} style={{ marginRight: 8 }} />
              ) : (
                <Feather name="send" size={20} color={Colors.white} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.postText}>{isUploading ? 'Đang tải...' : 'Đăng Khoảnh Khắc'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Footer cho mode CAPTURE: Nút chụp ảnh chính giữa
          <View style={styles.footerRow}>
            <View style={styles.footerSide} />
            <TouchableOpacity style={styles.captureOuter} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <View style={styles.footerSide}>
              <TouchableOpacity 
                onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} 
                style={styles.replyBtn}
              >
                <Feather name="refresh-ccw" size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ===== OVERLAY LOADING ===== */}
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.loadingText}>Đang nén ảnh...</Text>
        </View>
      )}

      {/* ===== DROPDOWN MODAL ===== */}
      {showDropdown && (
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowDropdown(false)} />
          <View style={[styles.dropdownContent, { top: insets.top + 60 }]}>
            
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectUser(null)}>
              <View style={styles.dropdownItemIcon}>
                <Feather name="users" size={16} color={Colors.white} />
              </View>
              <Text style={styles.dropdownItemText}>Mọi người</Text>
              {selectedUserId === null && <Feather name="check" size={20} color={Colors.white} />}
            </TouchableOpacity>

            {myProfile && (
              <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectUser(myProfile.id)}>
                {myProfile.avatar ? (
                  <Image source={{ uri: myProfile.avatar }} style={styles.dropdownItemAvatar} />
                ) : (
                  <View style={styles.dropdownItemIcon}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Bạn</Text>
                  </View>
                )}
                <Text style={styles.dropdownItemText}>Bạn</Text>
                {selectedUserId === myProfile.id && <Feather name="check" size={20} color={Colors.white} />}
              </TouchableOpacity>
            )}

            {friends.map(friend => (
              <TouchableOpacity key={friend.id} style={styles.dropdownItem} onPress={() => handleSelectUser(friend.id)}>
                {friend.avatar ? (
                  <Image source={{ uri: friend.avatar }} style={styles.dropdownItemAvatar} />
                ) : (
                  <View style={styles.dropdownItemIcon}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{friend.name.charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.dropdownItemText}>{friend.name}</Text>
                {selectedUserId === friend.id && <Feather name="check" size={20} color={Colors.white} />}
              </TouchableOpacity>
            ))}

          </View>
        </View>
      )}

      {/* ===== REACTION LIST MODAL (xem moment của mình) ===== */}
      <ReactionListModal
        visible={showReactionModal}
        reactions={reactions}
        onClose={() => setShowReactionModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill, // Chiếm toàn màn hình bất kể dù mở từ đâu
    backgroundColor: '#1E1E1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',     // Nằm dưới cùa header box (trên icon mười)
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,           // Khoảng trống phíd dưới icon
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  audienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  audienceText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  contentWrapper: { display: 'none' }, // unused - kept to avoid style references breaking
  mainBox: { display: 'none' }, // unused
  fullScreen: { display: 'none' }, // unused
  
  // ========= UNIFIED PHOTO LAYOUT =========
  photoContainer: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  photoBox: {
    width: '100%',
    aspectRatio: 3 / 4,   // Cố định tỉ lệ: cả view + capture + preview đều giống nhau
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // ========= META AREA (view mode only) =========
  metaArea: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 4,
    alignItems: 'center',      // Căn giữa toàn bộ meta block
  },
  userInfoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',   // Tên + giờ căn giữa
    gap: 8,
    marginBottom: 4,
  },
  infoName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  infoTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
  },
  activityArea: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',   // Emoji row căn giữa
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  activityText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // =========================================
  // ===== UNIFIED FOOTER ====================
  footer: {
    height: 100,            // Cố định chiều cao footer cả 2 mode đều dùng
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 'auto',      // Đẩy footer xuống đáy bất kể nội dung phía trên
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  footerSide: {
    flex: 1,
    alignItems: 'flex-end', // Reply btn sẽ align phải
    justifyContent: 'center',
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
  },
  replyBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Giữ lại các button cũ mà preview mode dùng:
  captureContainerSmall: { display: 'none' }, // replaced by captureOuter
  captureBtnSmall: { display: 'none' },       // replaced by captureInner
  captureContainer: { display: 'none' },      // replaced by captureOuter
  captureBtnInner: { display: 'none' },       // replaced by captureInner
  closeFloatingBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  captionInputContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  captionInput: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 16,
    fontWeight: '600',
    minWidth: '50%',
    textAlign: 'center',
  },
  captionBadgeDisplay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  captionTextDisplay: {
    backgroundColor: 'rgba(230, 90, 0, 0.85)',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 16,
    fontWeight: 'bold',
    overflow: 'hidden',
    textAlign: 'center',
  },
  bottomArea: {
    height: 150,
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  authorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  authorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 6,
  },
  authorTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  viewBottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
  },
  fakeInput: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginRight: 12,
  },
  fakeInputText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
  },
  replyCameraBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  previewControls: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cancelText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 25,
    backgroundColor: Colors.primary,
  },
  postText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  messageBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  messageText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  btnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: Colors.white,
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  momentUserBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  momentUserName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  momentTime: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: 4,
  },
  dropdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
  },
  dropdownContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#2A3050',
    borderRadius: 16,
    paddingVertical: 8,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dropdownItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});
