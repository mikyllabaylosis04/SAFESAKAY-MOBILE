import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

const ICON_BG = '#D7E8FB';
const BLUE = '#1A5AD7';
const DOT = '#D5DDEA';

type Props = {
  urls: string[];
  width: number;
};

export function BoatPhotoCarousel({ urls, width }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPage, setViewerPage] = useState(0);
  const [viewerStart, setViewerStart] = useState(0);
  const height = Math.round(width * 0.62);

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>, pageWidth: number, setter: (value: number) => void) {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setter(Math.min(urls.length - 1, Math.max(0, next)));
  }

  function openViewer(index: number) {
    setViewerStart(index);
    setViewerPage(index);
    setViewerOpen(true);
  }

  return (
    <>
      <View style={[styles.wrap, { width }]}>
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => onScrollEnd(event, width, setPage)}
          style={{ width, height }}
          contentContainerStyle={{ height }}>
          {urls.map((url, index) => (
            <Pressable key={url} onPress={() => openViewer(index)}>
              <Image
                source={{ uri: url }}
                style={{ width, height, backgroundColor: ICON_BG }}
                contentFit="cover"
              />
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Maximize boat photo"
          onPress={() => openViewer(page)}
          style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]}>
          <Ionicons name="expand-outline" size={18} color="#FFFFFF" />
        </Pressable>
        <View style={styles.zoomHint} pointerEvents="none">
          <Ionicons name="search-outline" size={12} color="#FFFFFF" />
          <Text style={styles.zoomHintText}>Tap to zoom</Text>
        </View>
        {urls.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {urls.map((url, index) => (
              <View key={url} style={[styles.dot, index === page && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>

      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <StatusBar style="light" />
        <View style={styles.viewer}>
          <SafeAreaView style={styles.viewerSafe} edges={['top']}>
            <Pressable
              onPress={() => setViewerOpen(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </SafeAreaView>
          <ScrollView
            key={viewerStart}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            contentOffset={{ x: viewerStart * screenWidth, y: 0 }}
            onMomentumScrollEnd={(event) => onScrollEnd(event, screenWidth, setViewerPage)}>
            {urls.map((url) => (
              <Pressable key={url} style={{ width: screenWidth, height: screenHeight }} onPress={() => setViewerOpen(false)}>
                <Image
                  source={{ uri: url }}
                  style={{ width: screenWidth, height: screenHeight }}
                  contentFit="contain"
                />
              </Pressable>
            ))}
          </ScrollView>
          {urls.length > 1 ? (
            <View style={styles.viewerDots}>
              {urls.map((url, index) => (
                <View key={url} style={[styles.dot, index === viewerPage && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: ICON_BG,
  },
  zoomBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  zoomHint: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    zIndex: 3,
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: DOT,
  },
  dotActive: {
    backgroundColor: BLUE,
    width: 16,
  },
  viewer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerDots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
});
