// =========================================================
// app/(tabs)/_layout.tsx
// Cấu hình Bottom Tab Navigator cho ứng dụng
// =========================================================

import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet, DeviceEventEmitter } from 'react-native';
import { Colors } from '../../styles/colors';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseConfig';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import IncomingCallModal from '../../components/IncomingCallModal';

export default function TabLayout() {
  const { currentUser } = useCurrentUser();
  const [pendingFriendsCount, setPendingFriendsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingPopsCount, setPendingPopsCount] = useState(0);

  useEffect(() => {
    if (!currentUser?.id) return;

    let mounted = true;

    // Fetch initial counts
    const fetchCounts = async () => {
      const fetchFriendsCount = async () => {
        try {
          const { count, error } = await supabase
            .from('friends')
            .select('id', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');
          if (!error && mounted) setPendingFriendsCount(count || 0);
          if (error) console.log("Friends badge error:", error.message);
        } catch {}
      };

      const fetchMessagesCount = async () => {
        try {
          // 1. Phải lấy danh sách id các cuộc hội thoại của MÌNH trước 
          // (nếu không nó sẽ đếm tin nhắn của tất cả mọi người trên server!)
          const { data: myConvs } = await supabase
            .from('conversations')
            .select('id')
            .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`);

          if (!myConvs || myConvs.length === 0) {
            if (mounted) setUnreadMessagesCount(0);
            return;
          }

          const myConvIds = myConvs.map(c => c.id);

          // 2. Lấy ra các tin nhắn trong các cuộc hội thoại đó
          const { data, error } = await supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', myConvIds)
            .neq('sender_id', currentUser.id)
            .eq('is_read', false);
          
          if (!error && mounted) {
            if (data) {
              const uniqueConvs = new Set(data.map(m => m.conversation_id));
              setUnreadMessagesCount(uniqueConvs.size);
            } else {
              setUnreadMessagesCount(0);
            }
          }
          if (error) console.log("Chat badge error:", error.message);
        } catch {}
      };

      fetchFriendsCount();
      fetchMessagesCount();
    };

    fetchCounts();

    // Polling fallback: kiểm tra mỗi 15 giây (phòng trường hợp Realtime bị delay)
    const pollingInterval = setInterval(fetchCounts, 15000);

    // Subscribe to realtime changes for friends table
    const friendsSub = supabase
      .channel('public:friends:badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friends' },
        () => { fetchCounts(); }
      )
      .subscribe();

    // Subscribe to realtime changes for messages table
    const messagesSub = supabase
      .channel('public:messages:badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload: any) => { 
          if (payload.new && payload.new.sender_id !== currentUser.id) {
             fetchCounts();
          } else if (payload.old) {
             fetchCounts();
          }
        }
      )
      .subscribe();

    // Lắng nghe sự kiện force update từ máy nội bộ (Fallback nếu Realtime bị delay/tắt)
    const localFriendSub = DeviceEventEmitter.addListener('friends_badge_update', () => {
      fetchCounts();
    });

    // Lắng nghe badge pops từ tab bản đồ (khi map screen xóa badge sau khi show rain)
    const popBadgeSub = DeviceEventEmitter.addListener('map_pops_badge_update', (count: number) => {
      setPendingPopsCount(count);
    });

    return () => {
      mounted = false;
      clearInterval(pollingInterval);
      supabase.removeChannel(friendsSub);
      supabase.removeChannel(messagesSub);
      localFriendSub.remove();
      popBadgeSub.remove();
    };
  }, [currentUser?.id]);

  // ---- Pops badge — chỉ lắng nghe sự kiện từ map.tsx ----
  // map.tsx sẽ quyết định tăng/giảm badge tùy theo isFocused
  useEffect(() => {
    const incSub = DeviceEventEmitter.addListener('map_pops_badge_increment', () => {
      setPendingPopsCount(prev => prev + 1);
    });
    const clearSub = DeviceEventEmitter.addListener('map_pops_badge_update', (count: number) => {
      setPendingPopsCount(count);
    });
    return () => {
      incSub.remove();
      clearSub.remove();
    };
  }, []);

  // Component Badge dùng chung
  const TabBadge = ({ count }: { count: number }) => {
    if (count <= 0) return null;
    return (
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
      </View>
    );
  };

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#0F1221',
          borderTopWidth: 1,
          borderTopColor: Colors.gray100,
          paddingTop: Platform.OS === 'ios' ? 8 : 0,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          height: Platform.OS === 'ios' ? 85 : 65,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Bản đồ',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Feather name="map" size={size} color={color} />
              <TabBadge count={pendingPopsCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Bạn bè',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Feather name="users" size={size} color={color} />
              <TabBadge count={pendingFriendsCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Trò chuyện',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Feather name="message-circle" size={size} color={color} />
              <TabBadge count={unreadMessagesCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    <IncomingCallModal userId={currentUser?.id} />
    </>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#FF3B30', // Messenger red
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0F1221',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
