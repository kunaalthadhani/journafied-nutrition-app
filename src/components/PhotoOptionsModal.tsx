import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Camera, Image, Info } from 'lucide-react-native';
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

  // A sheet the height of its own contents. The page sheet it used to be opened
  // to the top of the screen for two rows of text, and the empty space below
  // them read as a screen that had failed to load
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onModalDismiss}
    >
      <View style={styles.backdropWrap}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={['bottom', 'left', 'right']}>
          <View style={styles.grabber} />
          <Text style={styles.eyebrow}>ADD A PHOTO</Text>

          {showTip && (
            <View style={styles.tipRow}>
              <Info size={14} color={Acid.tx3} style={{ marginTop: 2 }} />
              <Text style={styles.tipText}>
                Typing is more accurate for portions. A photo is best for naming what is on the plate.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => {
              onClose();
              setTimeout(onTakePhoto, 250);
            }}
            activeOpacity={0.6}
          >
            <Camera size={20} color={Acid.lime} />
            <View style={styles.textContainer}>
              <Text style={styles.optionTitle}>Take a photo</Text>
              <Text style={styles.optionDescription}>Use the camera</Text>
            </View>
            <ChevronRight size={18} color={Acid.tx3} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, styles.optionRowLast]}
            onPress={() => {
              onClose();
              setTimeout(onUploadPhoto, 250);
            }}
            activeOpacity={0.6}
          >
            <Image size={20} color={Acid.lime} />
            <View style={styles.textContainer}>
              <Text style={styles.optionTitle}>Choose from library</Text>
              <Text style={styles.optionDescription}>Pick a photo you already have</Text>
            </View>
            <ChevronRight size={18} color={Acid.tx3} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancelRow} activeOpacity={0.6}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Acid.moss,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Acid.hair,
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Acid.hair2,
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: Acid.tx3,
    marginBottom: 14,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingBottom: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: Acid.tx3,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Acid.hair,
  },
  optionRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: Acid.hair,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: Typography.fontSize.md,
    color: Acid.tx,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
    color: Acid.tx3,
  },
  cancelRow: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 13,
    letterSpacing: 1,
    color: Acid.tx3,
  },
});
