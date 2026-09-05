// =========================================================
// app/chat/[id].tsx
// Màn hình chi tiết cuộc trò chuyện (Real-time Messaging)
// =========================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../styles/colors';
import { getMessages, sendMessage, subscribeToMessages, markMessagesAsRead, Message, uploadChatImage } from '../../services/chatService';
import { supabase } from '../../services/supabaseConfig';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import ChatBubble from '../../components/ChatBubble';
import ChatCameraModal from '../../components/ChatCameraModal';
import { createCall } from '../../services/callService';

export default function ChatDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const avatar = Array.isArray(params.avatar) ? params.avatar[0] : params.avatar;
  const otherUserId = Array.isArray(params.otherUserId) ? params.otherUserId[0] : params.otherUserId;
  const rawReplyUrl = Array.isArray(params.replyMomentUrl) ? params.replyMomentUrl[0] : params.replyMomentUrl;
  const initialReplyUrl = rawReplyUrl ? decodeURIComponent(rawReplyUrl) : null;

  const { currentUser } = useCurrentUser();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyMoment, setReplyMoment] = useState<string | null>(initialReplyUrl || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [displayName, setDisplayName] = useState(name);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    if (!id) return;
    
    // 1. Fetch tin nhắn cũ & mark read
    getMessages(id).then(data => {
      setMessages(data);
      setTimeout(scrollToBottom, 50);
      // Đánh dấu đã đọc khi mở chat
      markMessagesAsRead(id).catch(e => console.log('Mark read error:', e));
    }).catch(console.error);

    // 2. Fetch biệt danh & cài đặt
    const fetchSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const { data: conv } = await supabase
          .from('conversations')
          .select('user1_id, user2_id, user1_nickname, user2_nickname')
          .eq('id', id)
          .single();
        
        if (conv) {
          const isUser1 = conv.user1_id === session.user.id;
          const nick = isUser1 ? conv.user1_nickname : conv.user2_nickname;
          if (nick) setDisplayName(nick);
        }
      } catch (e) {
        console.log('Fetch settings error:', e);
      }
    };
    fetchSettings();

    // 3. Lắng nghe tin nhắn mới realtime
    const unsubscribe = subscribeToMessages(id, (newMsg) => {
      setMessages(prev => {
        // Tránh duplicate nếu mình vừa gửi xong (Supabase cũng bắn lại event)
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(scrollToBottom, 50);

      // Nếu người kia vừa gửi tới lúc mình đang mở, mark read luôn
      if (newMsg.sender_id !== currentUser?.id) {
        markMessagesAsRead(id).catch(() => {});
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, id, scrollToBottom]);

  const handleSend = async () => {
    if ((!inputText.trim() && !replyMoment) || !id) return;
    const previousInput = inputText;
    const previousReply = replyMoment;
    let textToSend = inputText.trim();
    if (replyMoment) {
      textToSend = `[REPLY_MOMENT:${replyMoment}]${textToSend}`;
    }

    setInputText('');
    setReplyMoment(null);
    
    try {
      // Lấy otherUserId để cộng điểm (nhận từ params hoặc query)
      let targetUserId = otherUserId as string | undefined;
      if (!targetUserId && currentUser) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('user1_id, user2_id')
          .eq('id', id)
          .maybeSingle();
        if (conv) {
          targetUserId = conv.user1_id === currentUser.id ? conv.user2_id : conv.user1_id;
        }
      }

      const sentMsg = await sendMessage(id, textToSend, targetUserId);
      setMessages(prev => {
        if (prev.find(m => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.log('Error send message:', e);
      setInputText(previousInput);
      setReplyMoment(previousReply);
      Alert.alert('Không gửi được tin nhắn', 'Nội dung đã được giữ lại. Vui lòng thử lại.');
    }
  };

  const handleImageReady = async (uri: string) => {
    try {
      setIsUploadingImage(true);
      const imageUrl = await uploadChatImage(uri);
      
      let targetUserId = otherUserId as string | undefined;
      if (!targetUserId && currentUser) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('user1_id, user2_id')
          .eq('id', id)
          .maybeSingle();
        if (conv) {
          targetUserId = conv.user1_id === currentUser.id ? conv.user2_id : conv.user1_id;
        }
      }

      const sentMsg = await sendMessage(id, `[IMAGE:${imageUrl}]`, targetUserId);
      setMessages(prev => {
        if (prev.find(m => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      setTimeout(scrollToBottom, 100);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể gửi ảnh');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleStartCall = async (isVideo: boolean) => {
    if (!id || isStartingCall) return;
    setIsStartingCall(true);
    try {
      const call = await createCall(id, isVideo);
      router.push({
        pathname: '/call',
        params: {
          callId: call.id,
          name: displayName || name || 'Người dùng Tibro',
          avatar: avatar || '',
          isVideo: isVideo ? '1' : '0',
          outgoing: '1',
        },
      } as any);
    } catch (error: any) {
      Alert.alert('Không thể gọi', error?.message || 'Vui lòng thử lại sau.');
    } finally {
      setIsStartingCall(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerInfo}
            activeOpacity={0.7}
            onPress={() => router.push({
              pathname: '/chat/settings/[id]',
              params: { id, name, avatar, otherUserId }
            })}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                <Text style={styles.headerAvatarText}>
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <Text style={styles.headerName}>{displayName}</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            {isStartingCall ? (
              <ActivityIndicator size="small" color={Colors.primary} style={styles.actionBtn} />
            ) : (
              <>
                <TouchableOpacity
                  accessibilityLabel="Gọi thoại"
                  style={styles.actionBtn}
                  onPress={() => handleStartCall(false)}
                >
                  <Feather name="phone" size={21} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Gọi video"
                  style={styles.actionBtn}
                  onPress={() => handleStartCall(true)}
                >
                  <Feather name="video" size={22} color={Colors.primary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* List tin nhắn */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          renderItem={({ item, index }) => {
            const isMine = currentUser?.id === item.sender_id;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            let showTimeAbove = false;
            
            if (!prevMsg) {
              showTimeAbove = true;
            } else {
              const diffMs = new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime();
              if (diffMs > 10 * 60 * 1000) {
                showTimeAbove = true; // Lớn hơn 10 phút
              }
            }

            return (
              <ChatBubble 
                message={item} 
                isMine={isMine} 
                showTimeAbove={showTimeAbove}
              />
            );
          }}
        />

        {/* Reply Moment Preview */}
        {replyMoment && (
          <View style={styles.replyMomentPreview}>
            <Image source={{ uri: replyMoment }} style={styles.replyMomentImage} />
            <Text style={styles.replyMomentText}>Đang trả lời khoảnh khắc...</Text>
            <TouchableOpacity onPress={() => setReplyMoment(null)} style={styles.replyMomentClose}>
              <Feather name="x" size={16} color={Colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* Camera Modal */}
        <ChatCameraModal
          visible={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          onImageReady={handleImageReady}
        />

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.cameraBtn} 
            onPress={() => setShowCameraModal(true)}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Feather name="camera" size={22} color={Colors.primary} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendBtn, (!inputText.trim() && !replyMoment) && styles.sendBtnDisabled]} 
            onPress={handleSend}
            disabled={!inputText.trim() && !replyMoment}
          >
            <Feather name="send" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.black },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    backgroundColor: Colors.black,
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  headerAvatarPlaceholder: { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: Colors.primary, fontWeight: 'bold', fontSize: 16 },
  headerName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginLeft: 8 },
  
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: Colors.black,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  cameraBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  
  // Reply Moment
  replyMomentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 8,
    borderRadius: 12,
  },
  replyMomentImage: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
  },
  replyMomentText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  replyMomentClose: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
});
