// =========================================================
// components/OnlineBadge.tsx
// Hiển thị một chấm chỉ báo trạng thái online/offline
// =========================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../styles/colors';

interface OnlineBadgeProps {
  isOnline: boolean;
  size?: number;
  showOffline?: boolean;
}

export default function OnlineBadge({ isOnline, size = 12, showOffline = true }: OnlineBadgeProps) {
  if (!isOnline && !showOffline) return null;

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isOnline ? Colors.success : Colors.gray400,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 2,
    borderColor: Colors.white,
  },
});
