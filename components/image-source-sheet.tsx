import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseGallery: () => void;
};

export function ImageSourceSheet({ visible, onClose, onTakePhoto, onChooseGallery }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 16),
              borderColor: colors.border,
            },
          ]}
          onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }]} />
          <Text style={[styles.title, { color: colors.navy }]}>Add proof photo</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Take a new photo or choose one from your gallery.
          </Text>

          <Pressable
            onPress={() => {
              onClose();
              onTakePhoto();
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1B2C4D' : '#EEF4FF' }]}>
              <Ionicons name="camera-outline" size={22} color="#1A5AD7" />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.navy }]}>Take Photo</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                Capture a new photo using your camera
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Pressable
            onPress={() => {
              onClose();
              onChooseGallery();
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1B2C4D' : '#EEF4FF' }]}>
              <Ionicons name="images-outline" size={22} color="#1A5AD7" />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.navy }]}>Choose from Gallery</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                Select an existing photo from your device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.72,
  },
});
