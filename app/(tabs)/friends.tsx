// =========================================================
// app/(tabs)/friends.tsx
// Màn hình Quản lý bạn bè (Danh sách + Lời mời + Tìm kiếm)
// =========================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../styles/colors';
import { FontSize } from '../../styles/globalStyles';
import {
  UserProfile, FriendRequest,
  searchUsers, getFriends, getPendingRequests, getSentRequests,
  sendFriendRequest, respondToRequest, getFriendshipStatus,
  unfriend, cancelFriendRequest
} from '../../services/friendService';
import { getOrCreateConversation } from '../../services/chatService';
import FriendItem from '../../components/FriendItem';
import EmptyState from '../../components/EmptyState';
import { supabase } from '../../services/supabaseConfig';

export default function FriendsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'list' | 'requests' | 'search'>('list');
  
  // Data
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // States check
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'list') {
        const [friendsData, reqsData] = await Promise.all([
          getFriends(),
          getPendingRequests()
        ]);
        setFriends(friendsData);
        setRequests(reqsData);
      } else if (activeTab === 'requests') {
        const [incoming, outgoing] = await Promise.all([
          getPendingRequests(),
          getSentRequests()
        ]);
        setRequests(incoming);
        setSentRequests(outgoing);
      }
    } catch (e) {
      console.log('Error fetch friend data', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch data khi đổi tab
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // online_at của bạn bè được đọc qua RPC bảo mật nên refresh nhẹ theo chu kỳ.
  // Không bật loading ở đây để danh sách không nhấp nháy mỗi lần cập nhật presence.
  useEffect(() => {
    if (activeTab !== 'list') return;

    const refreshPresence = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        setFriends(await getFriends());
      } catch (e) {
        console.log('Error refresh friend presence', e);
      }
    };

    const interval = setInterval(refreshPresence, 30000);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshPresence();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [activeTab]);

  // Realtime: tự động refresh khi có lời mời kết bạn mới
  useEffect(() => {
    const channel = supabase
      .channel('friends_screen_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friends' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;
    try {
      const results = await searchUsers(query.trim());
      setSearchResults(results);
      
      // Fetch status cho các kết quả tìm kiếm
      const statuses: Record<string, string> = {};
      for (const user of results) {
        const { status } = await getFriendshipStatus(user.id);
        if (status) statuses[user.id] = status;
      }
      setFriendStatuses(statuses);
    } catch (e) {
      console.log('Search error', e);
    } finally {
      setSearching(false);
    }
  };

  const onSearchQueryChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!text.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await sendFriendRequest(userId);
      setFriendStatuses(prev => ({ ...prev, [userId]: 'pending' }));
      Alert.alert('Thành công', 'Đã gửi lời mời kết bạn!');
    } catch (e: any) {
      Alert.alert('Lỗi', e.message);
    }
  };

  const handleCancelRequest = (userId: string) => {
    Alert.alert(
      'Thu hồi lời mời',
      'Bạn có chắc muốn thu hồi lời mời kết bạn này?',
      [
        { text: 'Không', style: 'cancel' },
        { 
          text: 'Thu hồi', 
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelFriendRequest(userId);
              setFriendStatuses(prev => {
                const updated = { ...prev };
                delete updated[userId];
                return updated;
              });
              Alert.alert('Đã thu hồi', 'Lời mời kết bạn đã được thu hồi.');
            } catch {
              Alert.alert('Lỗi', 'Không thể thu hồi lúc này.');
            }
          }
        }
      ]
    );
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await respondToRequest(requestId, accept);
      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== requestId));
      if (accept) Alert.alert('Thành công', 'Đã trở thành bạn bè!');
    } catch {
      Alert.alert('Lỗi', 'Không thể xử lý yêu cầu. Thử lại sau.');
    }
  };

  const handleUnfriend = (friend: UserProfile) => {
    Alert.alert(
      'Hủy kết bạn',
      `Bạn có chắc muốn hủy kết bạn với ${friend.name}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đồng ý', 
          style: 'destructive',
          onPress: async () => {
            try {
              await unfriend(friend.id);
              // Cập nhật state cục bộ ngay lập tức
              setFriends(prev => prev.filter(f => f.id !== friend.id));
            } catch {
              Alert.alert('Lỗi', 'Không thể hủy kết bạn lúc này.');
            }
          }
        }
      ]
    );
  };

  const renderTab = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity 
        style={[styles.tabBtn, activeTab === 'list' && styles.tabBtnActive]} 
        onPress={() => setActiveTab('list')}
      >
        <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>Bạn bè</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tabBtn, activeTab === 'requests' && styles.tabBtnActive]} 
        onPress={() => setActiveTab('requests')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>Lời mời</Text>
          {requests.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{requests.length > 99 ? '99+' : requests.length}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]} 
        onPress={() => setActiveTab('search')}
      >
        <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Tìm kiếm</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bạn bè</Text>
        <TouchableOpacity 
          style={styles.radarBtn}
          onPress={() => router.push('/radar')}
        >
          <Feather name="target" size={18} color={Colors.white} />
          <Text style={styles.radarBtnText}>Tìm quanh đây</Text>
        </TouchableOpacity>
      </View>
      
      {renderTab()}

      {/* ================= LIST TAB ================= */}
      {activeTab === 'list' && (
        loading ? <ActivityIndicator style={styles.loader} color={Colors.primary} /> :
        <FlatList
          data={friends}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <FriendItem 
              user={item} 
              onPress={() => {}}
              rightAction={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity style={styles.chatIconBtn} onPress={async () => {
                    try {
                      const convId = await getOrCreateConversation(item.id);
                      router.push({ 
                        pathname: '/chat/[id]', 
                        params: { 
                          id: convId,
                          name: item.name,
                          avatar: item.avatar || ''
                        } 
                      } as any);
                    } catch {
                      Alert.alert('Lỗi', 'Không thể mở cuộc trò chuyện.');
                    }
                  }}>
                    <Feather name="message-circle" size={20} color={Colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.chatIconBtn, { backgroundColor: '#FEE2E2' }]} 
                    onPress={() => handleUnfriend(item)}
                  >
                    <Feather name="user-x" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              }
            />
          )}
          ListEmptyComponent={<EmptyState emoji="👋" title="Chưa có bạn bè" description="Hãy tìm kiếm và thêm bạn bè để bắt đầu chia sẻ vị trí." />}
        />
      )}

      {/* ================= REQUESTS TAB ================= */}
      {activeTab === 'requests' && (
        loading ? <ActivityIndicator style={styles.loader} color={Colors.primary} /> :
        <FlatList
          data={[...requests, ...sentRequests]}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            if (!item.other_user) return null;
            const isSentByMe = sentRequests.some(r => r.id === item.id);
            return (
              <FriendItem 
                user={item.other_user} 
                subText={isSentByMe ? 'Bạn đã gửi lời mời' : 'Đã gửi lời mời cho bạn'}
                rightAction={
                  isSentByMe ? (
                    <TouchableOpacity 
                      style={[styles.reqBtn, { backgroundColor: 'rgba(239,68,68,0.15)' }]} 
                      onPress={() => handleCancelRequest(item.other_user!.id)}
                    >
                      <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Thu hồi</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.requestActions}>
                      <TouchableOpacity style={[styles.reqBtn, styles.reqAcceptBtn]} onPress={() => handleRespond(item.id, true)}>
                        <Text style={styles.reqAcceptText}>Chấp nhận</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.reqBtn, styles.reqDeclineBtn]} onPress={() => handleRespond(item.id, false)}>
                        <Feather name="x" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )
                }
              />
            );
          }}
          ListEmptyComponent={<EmptyState emoji="📫" title="Hộp thư trống" description="Bạn chưa có lời mời kết bạn nào." />}
        />
      )}

      {/* ================= SEARCH TAB ================= */}
      {activeTab === 'search' && (
        <View style={styles.content}>
          <View style={styles.searchBox}>
            <Feather name="search" size={20} color={Colors.gray400} />
            <TextInput
              style={styles.searchInput}
              placeholder="Nhập tên hoặc username..."
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                if (searchQuery.trim()) {
                  setSearching(true);
                  performSearch(searchQuery);
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={Colors.primary} style={{marginLeft: 10}}/>}
          </View>
          
          <FlatList
            data={searchResults}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const status = friendStatuses[item.id];
              return (
                <FriendItem 
                  user={item} 
                  rightAction={
                    status === 'accepted' ? (
                      <View style={styles.statusBadge}><Text style={styles.statusText}>Bạn bè</Text></View>
                    ) : status === 'pending' ? (
                      <TouchableOpacity 
                        style={[styles.statusBadge, styles.statusPending]} 
                        onPress={() => handleCancelRequest(item.id)}
                      >
                        <Text style={styles.statusTextPending}>Thu hồi</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.addBtn} onPress={() => handleSendRequest(item.id)}>
                        <Text style={styles.addBtnText}>Kết bạn</Text>
                      </TouchableOpacity>
                    )
                  }
                />
              );
            }}
            ListEmptyComponent={
              searchQuery.trim().length > 0 && !searching ? 
              <EmptyState emoji="🔍" title="Không tìm thấy người dùng" description="Hãy kiểm tra lại từ khóa tìm kiếm nhé." /> : null
            }
          />
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.black },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 20, 
    paddingBottom: 10 
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  radarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  radarBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  tabBtn: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 6,
    marginTop: -2,
  },
  tabBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },

  content: { flex: 1 },
  loader: { marginTop: 40 },

  chatIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  // Request actions
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  reqAcceptBtn: { backgroundColor: Colors.primary },
  reqAcceptText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  reqDeclineBtn: { backgroundColor: Colors.gray100, paddingHorizontal: 12 },

  // Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.inputBg,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  addBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  statusBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.gray100,
  },
  statusPending: { backgroundColor: Colors.warningLight },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.gray500 },
  statusTextPending: { fontSize: 12, fontWeight: '600', color: Colors.warningDark },
});
