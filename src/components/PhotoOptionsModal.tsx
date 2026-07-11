import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, Camera, Image, Info } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

const TIP_COUNT_KEY = 'photo_modal_open_count';
const TIP_LAST_SHOWN_KEY = 'photo_tip_last_shown_date';

interface PhotoOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onUploadPhoto: () => void;
  onModalDismiss?: () => void;
}

export const PhotoOptionsModal: React.FC<PhotoOptionsModalProps> = ({
  visible,
  onClose,
  onTakePhoto,
  onUploadPhoto,
  onModalDismiss,
}) => {
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const checkTip = async () => {
      try {
        const countStr = await AsyncStorage.getItem(TIP_COUNT_KEY);
        const count = countStr ? parseInt(countStr, 10) : 0;
        const newCount = count + 1;
        await AsyncStorage.setItem(TIP_COUNT_KEY, String(newCount));

        if (newCount <= 10) {
          // First 10 opens: always show
          setShowTip(true);
          await AsyncStorage.setItem(TIP_LAST_SHOWN_KEY, new Date().toDateString());
        } else {
          // After 10: show once per day
          const lastShown = await AsyncStorage.getItem(TIP_LAST_SHOWN_KEY);
          const today = new Date().toDateString();
          if (lastShown !== today) {
            setShowTip(true);
            await AsyncStorage.setItem(TIP_LAST_SHOWN_KEY, today);
          } else {
            setShowTip(false);
          }
        }
      } catch {
        setShowTip(false);
      }
    };

    checkTip();
  }, [visible]);

  // Reset tip when modal closes
  useEffect(() => {
    if (!visible) {
      setShowTip(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onModalDismiss}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: Acid.moss }]} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: Acid.hair }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronDown size={28} color={Acid.tx} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Acid.tx }]}>
            Add Image
          </Text>
          <View style={styles.closeButton} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Accuracy Tip */}
          {showTip && (
            <View style={[styles.tipBanner, { backgroundColor: Acid.good + '20', borderColor: Acid.good + '30' }]}>
              <Info size={16} color={Acid.good} style={{ marginTop: 1 }} />
              <Text style={[styles.tipText, { color: Acid.tx2 }]}>
                Typing your meal is more accurate for portions and calories. Image analysis works best for identifying what's on your plate.
              </Text>
            </View>
          )}

          {/* Take Photo */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}
            onPress={() => {
              onClose();
              setTimeout(onTakePhoto, 300);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
              <Camera size={24} color="#3B82F6" />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.optionTitle, { color: Acid.tx }]}>Take Photo</Text>
              <Text style={[styles.optionDescription, { color: Acid.tx2 }]}>Use your camera to capture food</Text>
            </View>
            <ChevronRight size={20} color={Acid.tx3} />
          </TouchableOpacity>

          {/* Choose from Library */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}
            onPress={() => {
              onClose();
              setTimeout(onUploadPhoto, 300);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}>
              <Image size={24} color={Acid.good} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.optionTitle, { color: Acid.tx }]}>Choose from Library</Text>
              <Text style={[styles.optionDescription, { color: Acid.tx2 }]}>Select an existing photo</Text>
            </View>
            <ChevronRight size={20} color={Acid.tx3} />
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: Typography.fontSize.sm,
  },
});
