import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  const handleTakePhoto = () => {
    console.log('PhotoOptionsModal: handleTakePhoto called');
    onTakePhoto();
  };

  const handleUploadPhoto = () => {
    console.log('PhotoOptionsModal: handleUploadPhoto called');
    onUploadPhoto();
  };

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
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={24} color="#14B8A6" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Upload Image
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* Upload Area */}
        <View style={styles.uploadSection}>
                <TouchableOpacity 
            style={[
              styles.uploadArea,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.accent,
                borderStyle: 'dashed',
              },
            ]}
            onPress={handleUploadPhoto}
            activeOpacity={0.8}
                >
            <View style={styles.uploadContent}>
              <View style={[styles.cloudIconContainer, { backgroundColor: theme.colors.accentBg }]}>
                <Feather name="upload-cloud" size={48} color="#14B8A6" />
                  </View>
              <Text style={[styles.uploadText, { color: theme.colors.textPrimary }]}>
                Drag & drop your image OR
              </Text>
                <TouchableOpacity 
                onPress={handleUploadPhoto}
                  activeOpacity={0.7}
                style={styles.browseButton}
              >
                <Text style={[styles.browseText, { color: theme.colors.info }]}>
                  Browse files
                </Text>
              </TouchableOpacity>
                  </View>
                </TouchableOpacity>

          {/* Alternative: Take Picture */}
          <View style={styles.alternativeSection}>
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            </View>
                
                <TouchableOpacity 
              style={[
                styles.takePhotoButton,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleTakePhoto}
              activeOpacity={0.8}
                >
              <View style={styles.takePhotoContent}>
                <View style={[styles.cameraIconContainer, { backgroundColor: theme.colors.accentBg }]}>
                  <Feather name="camera" size={32} color="#14B8A6" />
                </View>
                <View style={styles.takePhotoTextContainer}>
                  <Text style={[styles.takePhotoTitle, { color: theme.colors.textPrimary }]}>
                    Take Picture
                  </Text>
                  <Text style={[styles.takePhotoSubtitle, { color: theme.colors.textSecondary }]}>
                    Use your camera to capture an image
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#14B8A6" />
              </View>
                </TouchableOpacity>
              </View>
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
    borderBottomWidth: 1,
    height: 60,
    },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    flex: 1,
    textAlign: 'center',
  },
  uploadSection: {
    flex: 1,
    padding: Spacing.lg,
  },
  uploadArea: {
    width: '100%',
    minHeight: 200,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  uploadContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  uploadText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  browseButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  browseText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  alternativeSection: {
    width: '100%',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  takePhotoButton: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  takePhotoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  takePhotoTextContainer: {
    flex: 1,
  },
  takePhotoTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  takePhotoSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.normal,
  },
});
