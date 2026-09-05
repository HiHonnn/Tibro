// =========================================================
// components/EmptyState.tsx
// Component hiển thị khi không có dữ liệu (bạn bè, tin nhắn)
// =========================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../styles/colors';
import { FontSize } from '../styles/globalStyles';

interface EmptyStateProps {
  emoji: string;
  title: string;
  description: string;
}

export default function EmptyState({ emoji, title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    minHeight: 200,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
