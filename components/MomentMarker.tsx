// =========================================================
// components/MomentMarker.tsx
// Hiển thị một marker chứa ảnh khoảnh khắc của user
// =========================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from './PlatformMap';
import { Image } from 'expo-image';
import { MomentData } from '../services/momentService';
import { Colors } from '../styles/colors';
import { Feather } from '@expo/vector-icons';

interface MomentMarkerProps {
  moment: MomentData;
  onPress: (moment: MomentData) => void;
}

export const MomentMarker: React.FC<MomentMarkerProps> = ({ moment, onPress }) => {
  return (
    <Marker
      coordinate={{ latitude: moment.latitude, longitude: moment.longitude }}
      onPress={(e) => {
        e.stopPropagation();
        onPress(moment);
      }}
      tracksViewChanges={false} // Performance optimization
    >
      <View style={styles.container}>
        <View style={styles.imageWrapper}>
          <Image 
            source={{ uri: moment.image_url }} 
            style={styles.image} 
            contentFit="cover" 
            cachePolicy="memory-disk"
          />
          {/* Badge để biết đây là ảnh (phân biệt với Avatar) */}
          <View style={styles.badge}>
            <Feather name="camera" size={10} color={Colors.white} />
          </View>
        </View>
        <View style={styles.triangle} />
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 60,
    height: 70, // Đủ để chứa tam giác bên dưới
  },
  imageWrapper: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E11D48', // Màu hồng đậm nổi bật
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#E11D48',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E11D48',
    transform: [{ rotate: '180deg' }],
    marginTop: -1, // Che viền
  },
});
