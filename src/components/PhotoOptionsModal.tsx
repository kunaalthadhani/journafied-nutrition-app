import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, Camera, Image } from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
// Removed unused animatable import

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
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onModalDismiss}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronDown size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Add Image
          </Text>
          <View style={styles.closeButton} />
        </View>

        {/* Options */}
        <View style={styles.content}>
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => {
              onClose();
              setTimeout(onTakePhoto, 300); // Allow modal to close first
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.textPrimary }]}>
              <Camera size={24} color={theme.colors.background} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>Take Photo</Text>
              <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>Use your camera to capture food</Text>
            </View>
            <ChevronRight size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => {
              onClose();
              setTimeout(onUploadPhoto, 300);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.textPrimary }]}>
              <Image size={24} color={theme.colors.background} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>Choose from Library</Text>
              <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>Select an existing photo</Text>
            </View>
            <ChevronRight size={20} color={theme.colors.textTertiary} />
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
    // borderBottomWidth: 1, // Clean look, maybe no border needed or make it subtle
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    // Minimal shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
