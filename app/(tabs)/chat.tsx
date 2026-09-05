// =========================================================
// app/(tabs)/chat.tsx
// Danh sách các cuộc trò chuyện
// =========================================================

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../styles/colors';
import { getConversations, Conversation } from '../../services/chatService';
import { supabase } from '../../services/supabaseConfig';
import FriendItem from '../../components/FriendItem';
import EmptyState from '../../components/EmptyState';

export default function ChatListScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (e) {
      console.log('Error fetch conversations', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  useEffect(() => {
    // Lắng nghe thay đổi tin nhắn để update realtime danh sách
    const messagesSub = supabase
      .channel('public:messages:chatlist')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesSub);
    };
  }, [fetchConversations]);

  const handleOpenChat = (conversationId: string, otherUser: any) => {
    router.push({
      pathname: '/chat/[id]' as any,
      params: { 
        id: conversationId, 
        name: otherUser?.name || 'Bạn',
        avatar: otherUser?.avatar || ''
      }
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tin nhắn</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            if (!item.other_user) return null;
            
            // Format time
            const timeStr = item.last_message_at 
              ? new Date(item.last_message_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})
              : '';

            // Format message preview
            let subText = item.last_message || 'Chưa có tin nhắn';
            if (item.last_message && item.last_message.startsWith('[IMAGE:')) {
              subText = 'Đã gửi ảnh';
            } else if (item.last_message && item.last_message.startsWith('[REPLY_MOMENT:')) {
              const match = item.last_message.match(/^\[REPLY_MOMENT:.+?\](.*)$/s);
              if (match) {
                const actualText = match[1].trim();
                subText = actualText.length > 0 ? actualText : 'Đã trả lời khoảnh khắc';
              }
            }

            // Format unread text override
            const unreadCount = item.unread_count || 0;
            const isUnread = unreadCount > 0;
            if (isUnread && unreadCount > 1) {
              subText = `+${unreadCount} tin nhắn mới`;
            }

            return (
              <FriendItem 
                user={item.other_user as any} 
                subText={subText}
                isUnread={isUnread}
                onPress={() => handleOpenChat(item.id, item.other_user)}
                rightAction={
                  <View style={styles.rightContent}>
                    <Text style={[styles.timeText, isUnread && { color: Colors.textPrimary, fontWeight: '700' }]}>{timeStr}</Text>
                  </View>
                }
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState 
              emoji="💬" 
              title="Chưa có tin nhắn" 
              description="Bắt đầu trò chuyện với bạn bè của bạn." 
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.black },
  header: { padding: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  loader: { marginTop: 40 },
  rightContent: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: Colors.gray400,
    fontWeight: '500',
  }
});
