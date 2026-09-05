// =========================================================
// app/intro.tsx
// Màn hình giới thiệu ứng dụng - hiển thị lần đầu tiên mở app.
// 3 trang slide với design hiện đại, full animation, StyleSheet.
// =========================================================

import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../styles/colors';
import { setIntroShown } from '../utils/storage';

const { width: W, height: H } = Dimensions.get('window');

// =========================================================
// Dữ liệu 3 trang slide
// =========================================================
const slides = [
  {
    id: '1',
    title: 'Chia Sẻ Vị Trí',
    subtitle: 'Thời gian thực',
    description:
      'Tự động chia sẻ vị trí của bạn với bạn bè theo thời gian thực. Luôn biết bạn bè đang ở đâu!',
    image: require('../assets/images/intro_1_removebg.png'),
    bg: '#0D1025',
    cardBg: '#6C63FF',
    accent: '#818CF8',
    decorColor: 'rgba(108,99,255,0.1)',
  },
  {
    id: '2',
    title: 'Kết Nối Bạn Bè',
    subtitle: 'Gần hơn mỗi ngày',
    description:
      'Khám phá và kết nối với những người đang ở gần bạn. Xây dựng mạng lưới xã hội dựa trên vị trí.',
    image: require('../assets/images/intro_2_removebg.png'),
    bg: '#0B1520',
    cardBg: '#10B981',
    accent: '#34D399',
    decorColor: 'rgba(16,185,129,0.1)',
  },
  {
    id: '3',
    title: 'Bump & Chia Sẻ',
    subtitle: 'Đơn giản & Nhanh chóng',
    description:
      'Chỉ cần chạm điện thoại với người khác để "bump" — trao đổi thông tin tức thì, không cần gõ gì cả!',
    image: require('../assets/images/intro_3_removebg.png'),
    bg: '#151005',
    cardBg: '#F59E0B',
    accent: '#FBBF24',
    decorColor: 'rgba(245,158,11,0.1)',
  },
];

type Slide = (typeof slides)[0];

// =========================================================
// Component từng slide
// =========================================================
function SlideItem({ item }: { item: Slide }) {
  return (
    <View style={[styles.slide, { backgroundColor: item.bg }]}>
      {/* ---- Decorative background shapes ---- */}
      <View style={[styles.decorCircleLg, { backgroundColor: item.decorColor }]} />
      <View style={[styles.decorCircleSm, { backgroundColor: item.decorColor }]} />
      <View style={[styles.decorCircleTop, { backgroundColor: item.decorColor }]} />

      {/* ---- Illustration — No card background, just the large image ---- */}
      <View style={styles.illustrationCard}>
        <Image source={item.image} style={styles.illustrationImage} resizeMode="contain" />
      </View>

      {/* ---- Subtitle chip ---- */}
      <View style={[styles.subtitleChip, { backgroundColor: item.decorColor }]}>
        <Text style={[styles.subtitleText, { color: item.accent }]}>{item.subtitle}</Text>
      </View>

      {/* ---- Title ---- */}
      <Text style={[styles.slideTitle, { color: item.accent }]}>{item.title}</Text>

      {/* ---- Description ---- */}
      <Text style={styles.slideDesc}>{item.description}</Text>
    </View>
  );
}

// =========================================================
// Pagination dots với animation width
// =========================================================
function PaginationDots({
  currentIndex,
  accent,
}: {
  currentIndex: number;
  accent: string;
}) {
  return (
    <View style={styles.dotsRow}>
      {slides.map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: currentIndex === i ? 28 : 8,
              backgroundColor: currentIndex === i ? accent : Colors.gray300,
            },
          ]}
        />
      ))}
    </View>
  );
}

// =========================================================
// Màn hình Intro chính
// =========================================================
export default function IntroScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentSlide = slides[currentIndex];
  const isLastSlide = currentIndex === slides.length - 1;

  // ---- Scroll handler ----
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / W);
    setCurrentIndex(index);
  };

  // ---- Next / Start ----
  const handleNext = () => {
    if (isLastSlide) {
      handleFinish();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  // ---- Skip ----
  const handleSkip = async () => {
    await handleFinish();
  };

  // ---- Finish intro ----
  const handleFinish = async () => {
    await setIntroShown();
    router.replace('/login' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={currentSlide.bg}
        translucent={false}
      />

      {/* ---- Skip button ---- */}
      {!isLastSlide && (
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Bỏ qua</Text>
        </TouchableOpacity>
      )}

      {/* ---- Slides FlatList ---- */}
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SlideItem item={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.flatList}
        bounces={false}
      />

      {/* ---- Bottom navigation ---- */}
      <View style={[styles.bottomNav, { backgroundColor: currentSlide.bg }]}>
        {/* Dots */}
        <PaginationDots currentIndex={currentIndex} accent={currentSlide.accent} />

        {/* Row: Full-width Next button */}
        <View style={styles.navRow}>
          {/* Next / Start button expanded to full width */}
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextBtn, { backgroundColor: currentSlide.accent }]}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              {isLastSlide ? 'Bắt Đầu' : 'Tiếp Theo  →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Slide counter */}
        <Text style={styles.slideCounter}>
          {currentIndex + 1} / {slides.length}
        </Text>
      </View>
    </View>
  );
}

// =========================================================
// Styles
// =========================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ---- Skip ----
  skipBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 20,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray600,
  },

  // ---- FlatList ----
  flatList: {
    flex: 1,
  },

  // ---- Slide ----
  slide: {
    width: W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 32,
    overflow: 'hidden',
  },

  // ---- Decorative circles ----
  decorCircleLg: {
    position: 'absolute',
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: W * 0.45,
    top: -W * 0.25,
    right: -W * 0.2,
  },
  decorCircleSm: {
    position: 'absolute',
    width: W * 0.5,
    height: W * 0.5,
    borderRadius: W * 0.25,
    bottom: W * 0.1,
    left: -W * 0.15,
  },
  decorCircleTop: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: H * 0.18,
    left: 30,
  },

  // ---- Illustration Container ----
  illustrationCard: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  cardHighlight: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },

  // ---- Subtitle chip ----
  subtitleChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ---- Slide text ----
  slideTitle: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  slideDesc: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },

  // ---- Bottom nav ----
  bottomNav: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    alignItems: 'center',
    gap: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // ---- Nav row ----
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 20,
    fontWeight: '700',
  },
  backBtnPlaceholder: {
    width: 52,
  },
  nextBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // ---- Slide counter ----
  slideCounter: {
    fontSize: 12,
    color: Colors.gray400,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
