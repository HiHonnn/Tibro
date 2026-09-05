import React, { forwardRef, ReactNode, useImperativeHandle } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

type WebMapProps = {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
};

type WebMapHandle = {
  animateToRegion: () => void;
};

type WebMarkerProps = {
  children?: ReactNode;
  onPress?: (event: { stopPropagation: () => void }) => void;
};

const WebMapView = forwardRef<WebMapHandle, WebMapProps>(({ children, style }, ref) => {
  useImperativeHandle(ref, () => ({ animateToRegion: () => undefined }), []);

  return (
    <View style={[styles.map, style]}>
      <View pointerEvents="none" style={styles.notice}>
        <Text style={styles.noticeText}>Bản đồ tương tác khả dụng trên Android/iOS</Text>
      </View>
      {children}
    </View>
  );
});

WebMapView.displayName = 'WebMapView';

export const Marker = ({ children, onPress }: WebMarkerProps) => (
  <Pressable onPress={() => onPress?.({ stopPropagation: () => undefined })}>
    {children}
  </Pressable>
);

export const Polyline = () => null;
export const PROVIDER_GOOGLE = 'google';

const styles = StyleSheet.create({
  map: {
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  notice: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noticeText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default WebMapView;
