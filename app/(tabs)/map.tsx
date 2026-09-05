// =========================================================
// app/(tabs)/map.tsx
// Màn hình Bản đồ (Trang chủ)
// Tích hợp: UserBottomSheet, MapActionPanel, Polyline lịch sử
// =========================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking, DeviceEventEmitter , StatusBar } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, Marker } from '../../components/PlatformMap';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../styles/colors';
import { supabase } from '../../services/supabaseConfig';
import { useLocation } from '../../hooks/useLocation';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getFriendsLocations, UserLocation } from '../../services/locationService';
import { getFriendIds } from '../../services/friendService';
import { getOrCreateConversation } from '../../services/chatService';
import { MomentData, getMapMoments } from '../../services/momentService';
import MapMarker from '../../components/MapMarker';
import UserBottomSheet, { haversineDistance } from '../../components/UserBottomSheet';
import MapActionPanel from '../../components/MapActionPanel';
import BumpModal from '../../components/BumpModal';
import mapStyle from '../../styles/mapStyle.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Image } from 'expo-image';
import { getAllIntimacies } from '../../services/intimacyService';
import { getUnreadCount, subscribeToNotifications } from '../../services/notificationService';
import { getAnnouncements } from '../../services/announcementService';
import NotificationPanel from '../../components/NotificationPanel';
import { sendPops, getUnseenPops, markPopsAsSeen } from '../../services/popService';
import EmojiRain from '../../components/EmojiRain';

export default function MapScreen() {
  const {
    location, errorMsg, retryLocation,
    isSharing, setIsSharing,
    saveHistory, setSaveHistory,
  } = useLocation();
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const isFocused = useIsFocused(); // true khi đang ở tab bản đồ
  const [friendsLocations, setFriendsLocations] = useState<UserLocation[]>([]);
  const mapRef = React.useRef<MapView>(null);

  // UI States
  const [selectedFriend, setSelectedFriend] = useState<UserLocation | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  // Notifications
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [hasAnnouncements, setHasAnnouncements] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Intimacy
  const [intimacyMap, setIntimacyMap] = useState<Map<string, number>>(new Map());

  // Bump Modal
  const [bumpTarget, setBumpTarget] = useState<UserLocation | null>(null);
  const [showBumpModal, setShowBumpModal] = useState(false);
  const bumpNotifiedRef = React.useRef<Set<string>>(new Set()); // tránh nô liên tục

  // Moments data
  const [moments, setMoments] = useState<MomentData[]>([]);

  // Emoji Pops
  const [emojiRainData, setEmojiRainData] = useState<{ id: string; emoji: string; count: number }[]>([]);
  const popCountRef = React.useRef<Record<string, number>>({});
  // Mỗi emoji có timer riêng để debounce độc lập nhau
  const popTimerRef = React.useRef<Record<string, any>>({});
  // Directions state
  const [directionsRoute, setDirectionsRoute] = useState<{
    coords: { latitude: number; longitude: number }[];
    friendName: string;
    distanceKm: number;
  } | null>(null);

  // Fetch vị trí bạn bè mỗi 10 giây
  useEffect(() => {
    let mounted = true;
    let timer: any;

    const fetchFriends = async () => {
      try {
        const friendIds = await getFriendIds();
        if (friendIds.length > 0) {
          const [locs, mapMoments] = await Promise.all([
            getFriendsLocations(friendIds),
            getMapMoments(friendIds).catch(() => [] as MomentData[])
          ]);
          if (mounted) {
            setFriendsLocations(locs);
            setMoments(mapMoments);
          }
        } else {
          // Chỉ có mình mình
          const mapMoments = await getMapMoments([]).catch(() => []);
          if (mounted) setMoments(mapMoments);
        }
      } catch (e) {
        console.log('Lỗi fetch friend locations / moments:', e);
      }
    };

    fetchFriends();
    timer = setInterval(fetchFriends, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  // ---- Load intimacy scores ----
  useEffect(() => {
    getAllIntimacies().then(map => setIntimacyMap(map)).catch(() => {});
  }, []);

  // ---- Load + subscribe thông báo ----
  useEffect(() => {
    getUnreadCount().then(setUnreadNotifCount).catch(() => {});
    getAnnouncements().then(anns => setHasAnnouncements(anns.length > 0)).catch(() => {});
    const unsub = subscribeToNotifications((newNotif) => {
      setUnreadNotifCount(prev => prev + 1);
    });
    return unsub;
  }, []);

  // ---- isFocusedRef luôn cập nhật mới nhất ----
  const isFocusedRef = useRef(isFocused);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

  // ---- Realtime: nhận pop mới ngay lập tức ----
  useEffect(() => {
    if (!currentUser?.id) return;
    const popsSub = supabase
      .channel(`map_pops:live:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'map_pops',
        filter: `receiver_id=eq.${currentUser.id}`,
      }, async (payload: any) => {
        const pop = payload.new;
        if (!pop) return;
        if (isFocusedRef.current) {
          // Đang ở tab bản đồ → show ngay + mark seen
          setEmojiRainData(prev => [...prev, { id: pop.id, emoji: pop.emoji, count: pop.count }]);
          markPopsAsSeen([pop.id]).catch(() => {});
        } else {
          // Ở tab khác → chỉ tăng badge, KHÔNG mark seen (để DB giữ lại cho query)
          DeviceEventEmitter.emit('map_pops_badge_increment');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(popsSub); };
  }, [currentUser?.id]);

  // ---- Khi focus vào tab bản đồ → query DB lấy tất cả pops chưa xem ----
  useEffect(() => {
    if (!isFocused) return;
    const showUnseenPops = async () => {
      try {
        const pops = await getUnseenPops();
        if (pops.length === 0) {
          DeviceEventEmitter.emit('map_pops_badge_update', 0);
          return;
        }
        const rainData = pops.map(p => ({ id: p.id, emoji: p.emoji, count: p.count }));
        await markPopsAsSeen(pops.map(p => p.id));
        setEmojiRainData(prev => [...prev, ...rainData]);
        DeviceEventEmitter.emit('map_pops_badge_update', 0);
      } catch (e) {
        console.log('showUnseenPops error:', e);
      }
    };
    // Delay nhỏ để UI ổn định sau khi chuyển tab, và để Realtime kịp deliver trước
    const timer = setTimeout(showUnseenPops, 800);
    return () => clearTimeout(timer);
  }, [isFocused]);

  // ---- Phát hiện bạn bè ở gần (<50m) — hiển thị popup Bump ----
  useEffect(() => {
    if (!location || friendsLocations.length === 0) return;
    const myLat = location.coords.latitude;
    const myLng = location.coords.longitude;

    for (const friend of friendsLocations) {
      const dist = haversineDistance(myLat, myLng, friend.latitude, friend.longitude); // km
      const fId = friend.user_id;

      if (dist < 0.05 && !bumpNotifiedRef.current.has(fId)) {
        // Đang ở gần nhau và chưa popup lần này
        bumpNotifiedRef.current.add(fId);
        setBumpTarget(friend);
        setShowBumpModal(true);
        break; // chỉ popup 1 người 1 lúc
      } else if (dist >= 0.05) {
        // Ra xa thì reset, lần sau gần lại sẽ popup lại
        bumpNotifiedRef.current.delete(fId);
      }
    }
  }, [location, friendsLocations]);

  const handleCenterMap = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const handleFriendChat = async (friendUserId: string, name: string, avatar: string) => {
    try {
      const convId = await getOrCreateConversation(friendUserId);
      setSelectedFriend(null);
      router.push({ 
        pathname: '/chat/[id]', 
        params: { id: convId, name, avatar } 
      } as any);
    } catch {
      Alert.alert('Lỗi', 'Không thể mở cuộc trò chuyện.');
    }
  };

  // ---- Chỉ đường handler: mở Google Maps ----
  const handleDirections = (friend: UserLocation) => {
    if (!location) return;
    const myLat = location.coords.latitude;
    const myLng = location.coords.longitude;
    const fLat = friend.latitude;
    const fLng = friend.longitude;
    // Mở Google Maps với chế độ chỉ đường
    const url = Platform.select({
      ios: `comgooglemaps://?saddr=${myLat},${myLng}&daddr=${fLat},${fLng}&directionsmode=driving`,
      android: `google.navigation:q=${fLat},${fLng}&mode=d`,
    });

    const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${myLat},${myLng}&destination=${fLat},${fLng}&travelmode=driving`;

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Nếu không có Google Maps, mở trên trình duyệt
          Linking.openURL(webUrl);
        }
      });
    } else {
      Linking.openURL(webUrl);
    }

    setSelectedFriend(null);
  };

  const fitToRoute = () => {
    if (!directionsRoute || directionsRoute.coords.length < 2) return;
    const lats = directionsRoute.coords.map(c => c.latitude);
    const lngs = directionsRoute.coords.map(c => c.longitude);
    mapRef.current?.animateToRegion({
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(0.01, (Math.max(...lats) - Math.min(...lats)) * 1.5),
      longitudeDelta: Math.max(0.01, (Math.max(...lngs) - Math.min(...lngs)) * 1.5),
    }, 800);
  };

  const estimateTimeStr = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)}m · ~${Math.ceil(km * 12)} phút`;
    if (km < 5) return `${km.toFixed(1)}km · ~${Math.ceil(km * 3)} phút`;
    return `${km.toFixed(1)}km · ~${Math.ceil(km * 2)} phút`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {errorMsg ? (
        <View style={styles.locationErrorContainer}>
          <Feather name="map-pin" size={42} color={Colors.primary} />
          <Text style={styles.locationErrorTitle}>Chưa thể hiển thị bản đồ</Text>
          <Text style={styles.locationErrorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.locationRetryButton} onPress={retryLocation}>
            <Text style={styles.locationRetryText}>Thử lại</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.locationSettingsButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.locationSettingsText}>Mở cài đặt vị trí</Text>
          </TouchableOpacity>
        </View>
      ) : !location ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang lấy vị trí của bạn...</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          customMapStyle={Platform.OS === 'android' ? mapStyle : undefined}
        >
          {/* Marker bản thân */}
          {isSharing && currentUser && (
            <MapMarker
              isMe
              // onPress={() => { ... }} // Đã bỏ tính năng bấm vào bản thân để xem moment
              location={{
                user_id: currentUser.id,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                is_sharing: true,
                updated_at: new Date().toISOString(),
                user: { name: currentUser.name, avatar: currentUser.avatar }
              }}
            />
          )}

          {/* Markers bạn bè */}
          {friendsLocations.map(loc => {
            return (
              <MapMarker
                key={loc.user_id}
                location={loc}
                onPress={() => setSelectedFriend(loc)}
              />
            );
          })}

          {/* Directions route polyline + markers */}
          {directionsRoute && (
            <>
              <Polyline
                coordinates={directionsRoute.coords}
                strokeColor="#1565C0"
                strokeWidth={5}
              />
              <Marker
                coordinate={directionsRoute.coords[0]}
                pinColor="#10B981"
                title="Bạn"
              />
              <Marker
                coordinate={directionsRoute.coords[directionsRoute.coords.length - 1]}
                pinColor="#EF4444"
                title={directionsRoute.friendName}
              />
            </>
          )}
        </MapView>
      )}

      {/* ------ Floating Controls ------ */}
      <SafeAreaView style={styles.controlsArea} pointerEvents="box-none" edges={['top', 'left', 'right']}>
        {/* Toggle Share FAB */}
        <TouchableOpacity
          style={[styles.fab, styles.fabTopRight, !isSharing && styles.fabOff]}
          onPress={async () => {
            const nextValue = !isSharing;
            try {
              await setIsSharing(nextValue);
              Alert.alert(
                nextValue ? 'Đã bật chia sẻ' : 'Đã tắt chia sẻ',
                nextValue ? 'Bạn bè giờ có thể thấy vị trí của bạn' : 'Bạn bè sẽ không thấy vị trí của bạn nữa'
              );
            } catch (error: any) {
              Alert.alert('Không thể cập nhật', error?.message || 'Vui lòng kiểm tra kết nối mạng.');
            }
          }}
          activeOpacity={0.8}
        >
          <Feather name={isSharing ? "eye" : "eye-off"} size={22} color={isSharing ? '#818CF8' : 'rgba(255,255,255,0.4)'} />
        </TouchableOpacity>

        {/* Settings Panel FAB */}
        <TouchableOpacity
          style={[styles.fab, styles.fabTopRight2]}
          onPress={() => setShowPanel(true)}
          activeOpacity={0.8}
        >
          <Feather name="sliders" size={22} color="#818CF8" />
        </TouchableOpacity>

        {/* Bell Notification FAB */}
        <TouchableOpacity
          style={[styles.fab, styles.fabTopRight3]}
          onPress={() => {
            setShowNotifPanel(true);
            setUnreadNotifCount(0); // Reset visual badge khi mở
            setHasAnnouncements(false); // Xóa chấm đỏ hệ thống
          }}
          activeOpacity={0.8}
        >
          <Feather name="bell" size={22} color="#FBBF24" />
          {(unreadNotifCount > 0 || hasAnnouncements) && (
            <View style={[styles.bellBadge, unreadNotifCount === 0 && { minWidth: 12, height: 12, top: -2, right: 0 }]}>
              {unreadNotifCount > 0 && (
                <Text style={styles.bellBadgeText}>
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Center My Location FAB */}
        <TouchableOpacity
          style={[styles.fab, styles.fabBottomRight]}
          onPress={handleCenterMap}
          activeOpacity={0.8}
        >
          <Feather name="navigation" size={22} color="#818CF8" />
        </TouchableOpacity>

        {/* Camera FAB */}
        <TouchableOpacity
          style={[styles.fabMenu, styles.fabCamera]}
          onPress={() => router.push('/camera')}
          activeOpacity={0.8}
        >
          <Feather name="camera" size={26} color={Colors.white} />
        </TouchableOpacity>

        {/* Floating Moment Stack */}
        {moments.length > 0 && (
          <TouchableOpacity
            style={styles.momentStackContainer}
            onPress={() => {
              router.push({
                pathname: '/camera',
                params: { momentsStr: JSON.stringify(moments), initialIndex: "0" }
              } as any);
            }}
            activeOpacity={0.8}
          >
            {moments.slice(0, 3).map((m, index) => (
              <Image 
                key={m.id}
                source={{ uri: m.image_url }}
                style={[
                  styles.momentStackItem, 
                  { 
                    zIndex: 10 - index, 
                    right: index * 10, 
                    bottom: index * 10,
                    borderColor: index === 0 ? '#E1306C' : '#fff'
                  }
                ]}
                contentFit="cover"
              />
            ))}
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* ------ Directions Info Bar ------ */}
      {directionsRoute && (
        <View style={styles.directionsBar}>
          <View style={styles.directionsInfo}>
            <Text style={styles.dirFriendName}>Đến {directionsRoute.friendName}</Text>
            <Text style={styles.dirDistance}>{estimateTimeStr(directionsRoute.distanceKm)}</Text>
          </View>
          <View style={styles.dirActions}>
            <TouchableOpacity style={styles.dirBtn} onPress={fitToRoute} activeOpacity={0.7}>
              <Feather name="maximize" size={16} color={Colors.white} />
              <Text style={styles.dirBtnText}>Fit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dirBtn, styles.dirBtnClear]} onPress={() => setDirectionsRoute(null)} activeOpacity={0.7}>
              <Feather name="x" size={16} color={Colors.white} />
              <Text style={styles.dirBtnText}>Xóa</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ------ Bottom Sheet (Friend clicked) ------ */}
      {selectedFriend && location && (
        <UserBottomSheet
          friendLocation={selectedFriend}
          myLat={location.coords.latitude}
          myLng={location.coords.longitude}
          onClose={() => setSelectedFriend(null)}
          onChat={() => handleFriendChat(
            selectedFriend.user_id,
            selectedFriend.user?.name || 'Bạn bè',
            selectedFriend.user?.avatar || ''
          )}
          onDirections={() => handleDirections(selectedFriend)}
          onHistory={() => {
            const name = selectedFriend.user?.name || 'Bạn bè';
            const avatar = selectedFriend.user?.avatar || '';
            setSelectedFriend(null);
            router.push({
              pathname: '/history/[userId]',
              params: { userId: selectedFriend.user_id, userName: name, userAvatar: avatar },
            } as any);
          }}
          intimacyScore={intimacyMap.get(selectedFriend.user_id)}
          isNearby={location ? haversineDistance(
            location.coords.latitude, location.coords.longitude,
            selectedFriend.latitude, selectedFriend.longitude
          ) < 0.05 : false}
          onBump={() => {
            setBumpTarget(selectedFriend);
            setShowBumpModal(true);
          }}
          onPop={(emoji) => {
            const friendId = selectedFriend.user_id;
            const key = `${friendId}_${emoji}`;
            // Tăng số đếm cho emoji này
            popCountRef.current[key] = (popCountRef.current[key] || 0) + 1;
            // Hủy timer cũ của đúng emoji này (không ảnh hưởng timer các emoji khác)
            if (popTimerRef.current[key]) clearTimeout(popTimerRef.current[key]);
            popTimerRef.current[key] = setTimeout(() => {
              const count = popCountRef.current[key] || 1;
              sendPops(friendId, emoji, count).catch((error: any) => {
                Alert.alert('Không gửi được Pop', error?.message || 'Vui lòng thử lại.');
              });
              popCountRef.current[key] = 0;
              delete popTimerRef.current[key];
            }, 800);
          }}
        />
      )}

      {/* ------ Emoji Rain ------ */}
      {emojiRainData.length > 0 && (
        <EmojiRain
          emojis={emojiRainData}
          onComplete={() => setEmojiRainData([])}
        />
      )}

      {/* ------ Bump Modal ------ */}
      {bumpTarget && (
        <BumpModal
          visible={showBumpModal}
          friendId={bumpTarget.user_id}
          friendName={bumpTarget.user?.name || 'Bạn bè'}
          friendAvatar={bumpTarget.user?.avatar}
          currentScore={intimacyMap.get(bumpTarget.user_id) ?? 0}
          onClose={() => setShowBumpModal(false)}
          onBumped={(newScore) => {
            setIntimacyMap(prev => new Map(prev).set(bumpTarget.user_id, newScore));
          }}
        />
      )}

      {/* ------ Map Action Panel ------ */}
      <MapActionPanel
        visible={showPanel}
        onClose={() => setShowPanel(false)}
        saveHistory={saveHistory}
        onToggleSaveHistory={(value) => {
          setSaveHistory(value).catch((error: any) => {
            Alert.alert('Không thể cập nhật', error?.message || 'Vui lòng kiểm tra kết nối mạng.');
          });
        }}
        isSharing={isSharing}
        onToggleSharing={(value) => {
          setIsSharing(value).catch((error: any) => {
            Alert.alert('Không thể cập nhật', error?.message || 'Vui lòng kiểm tra kết nối mạng.');
          });
        }}
      />

      {/* ------ Notification Panel ------ */}
      <NotificationPanel
        visible={showNotifPanel}
        onClose={() => setShowNotifPanel(false)}
        onOpenMoment={(moments, index) => {
          router.push({
            pathname: '/camera',
            params: { momentsStr: JSON.stringify(moments), initialIndex: String(index) },
          } as any);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.white,
    marginTop: 12,
    fontSize: 15,
  },
  locationErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  locationErrorTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  locationErrorText: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
  },
  locationRetryButton: {
    minWidth: 180,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  locationRetryText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  locationSettingsButton: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  locationSettingsText: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '600',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  controlsArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(15, 25, 45, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
  },
  fabTopRight: {
    top: 60,
    right: 20,
  },
  fabTopRight2: {
    top: 120,
    right: 20,
  },
  fabTopRight3: {
    top: 180,
    right: 20,
  },
  fabBottomRight: {
    bottom: 20,
    right: 20,
  },
  fabOff: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
  },
  // Bell notification badge
  bellBadge: {
    position: 'absolute',
    top: -4, right: -4,
    minWidth: 18, height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0B0F1A',
  },
  bellBadgeText: {
    fontSize: 10, fontWeight: '900', color: '#fff',
  },
  // Directions bar
  directionsBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 1000,
  },
  directionsInfo: { flex: 1 },
  dirFriendName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dirDistance: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '600',
    marginTop: 2,
  },
  dirActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dirBtnClear: {
    backgroundColor: '#EF4444',
  },
  dirBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  fabMenu: {
    position: 'absolute',
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(15, 25, 45, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
  },
  fabCamera: {
    bottom: 220,
    backgroundColor: Colors.primary,
  },
  momentStackContainer: {
    position: 'absolute',
    right: 16,
    bottom: 290,
    width: 70,
    height: 70,
  },
  momentStackItem: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: '#0D1B2A',
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
});
