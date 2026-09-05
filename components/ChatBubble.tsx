// =========================================================
// components/ChatBubble.tsx
// Component hiển thị tin nhắn chat (phải = của mình, trái = bạn)
// =========================================================

import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Message } from '../services/chatService';
import { Colors } from '../styles/colors';

interface ChatBubbleProps {
  message: Message;
  isMine: boolean;
  showTimeAbove?: boolean;
}

// ---- Regex parse reply moment & image message ----
const REPLY_MOMENT_REGEX = /^\[REPLY_MOMENT:(.+?)\](.*)$/s;
const IMAGE_MSG_REGEX = /^\[IMAGE:(.+?)\](.*)$/s;

const formatTimeAbove = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));

  const timePart = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return timePart;
  } else if (diffDays < 7) {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return `${timePart} ${days[date.getDay()]}`;
  } else {
    return `${timePart} ${date.getDate()}/${date.getMonth() + 1}`;
  }
};

export default function ChatBubble({ message, isMine, showTimeAbove }: ChatBubbleProps) {
  const [showDetailTime, setShowDetailTime] = useState(false);
  const time = new Date(message.created_at).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Kiểm tra xem tin nhắn có chứa reply moment hay hình ảnh hay không
  let actualText = message.content || '';
  let replyMomentUrl: string | null = null;
  let chatImageUrl: string | null = null;

  if (typeof actualText === 'string') {
    const replyMatch = actualText.match(REPLY_MOMENT_REGEX);
    if (replyMatch) {
      replyMomentUrl = replyMatch[1];
      actualText = replyMatch[2].trim();
    } else {
      const imgMatch = actualText.match(IMAGE_MSG_REGEX);
      if (imgMatch) {
        chatImageUrl = imgMatch[1];
        actualText = imgMatch[2].trim();
      }
    }
  }

  return (
    <View style={styles.wrapper}>
      {showTimeAbove && (
        <Text style={styles.timeAboveText}>{formatTimeAbove(message.created_at)}</Text>
      )}
      <View style={[styles.container, isMine ? styles.containerMine : styles.containerTheirs]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowDetailTime(!showDetailTime)}
        >
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, chatImageUrl && styles.bubbleImageOnly]}>
            {replyMomentUrl && (
              <View style={styles.replyImageContainer}>
                <Image
                  source={{ uri: replyMomentUrl }}
                  style={styles.replyImage}
                  resizeMode="cover"
                />
                <Text style={styles.replyImageLabel}>Phản hồi khoảnh khắc</Text>
              </View>
            )}
            {chatImageUrl && (
              <View style={styles.chatImageContainer}>
                <Image
                  source={{ uri: chatImageUrl }}
                  style={styles.chatImage}
                  resizeMode="cover"
                />
              </View>
            )}
            {actualText.length > 0 && (
              <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>
                {actualText}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        {showDetailTime && (
          <Text style={[styles.timeDetailText, isMine && styles.timeDetailTextMine]}>{time}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  containerMine: {
    alignSelf: 'flex-end',
  },
  containerTheirs: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: Colors.gray100,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  textMine: {
    color: Colors.white,
  },
  textTheirs: {
    color: Colors.textPrimary,
  },
  timeAboveText: {
    alignSelf: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  timeDetailText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    marginHorizontal: 4,
  },
  timeDetailTextMine: {
    alignSelf: 'flex-end',
  },

  // Reply moment styles
  replyImageContainer: {
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  replyImage: {
    width: 150,
    height: 150,
  },
  replyImageLabel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
  },
  
  // Chat image styles
  bubbleImageOnly: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  chatImageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  chatImage: {
    width: 200,
    height: 250,
  },
});
