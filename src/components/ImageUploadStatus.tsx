import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

interface ImageUploadStatusProps {
  visible: boolean;
  imageUri: string | null;
  fileName: string;
  progress: number; // 0-100
  status: 'uploading' | 'completed' | 'failed' | 'analyzing';
  onClose: () => void;
  onRetry?: () => void;
  statusMessage?: string | null;
}

export const ImageUploadStatus: React.FC<ImageUploadStatusProps> = ({
  visible,
  imageUri,
  fileName,
  progress,
  status,
  onClose,
  onRetry,
  statusMessage,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'uploading') {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, status]);

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return Acid.good;
      case 'failed':
        return Acid.error;
      case 'analyzing':
        return Acid.protein;
      default:
        return Acid.lime;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return 'check-circle';
      case 'failed':
        return 'alert-circle';
      case 'analyzing':
        return 'loader';
      default:
        return 'loader';
    }
  };

  const getFileIcon = () => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return 'image';
    }
    return 'file';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: Acid.moss }]} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: Acid.hair }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={24} color={Acid.good} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Acid.tx }]}>
            Upload Image
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* Upload Status Section */}
        <View style={styles.uploadStatusSection}>
          <Text style={[styles.statusText, { color: Acid.tx2 }]}>
            {status === 'uploading' && `Uploading - ${progress}%`}
            {status === 'analyzing' && (statusMessage || 'Analyzing image...')}
            {status === 'completed' && (statusMessage || 'Upload completed')}
            {status === 'failed' && (statusMessage || 'Upload failed')}
          </Text>

          {/* File List */}
          <View style={[styles.fileItem, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
            <View style={styles.fileIconContainer}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.fileImage} />
              ) : (
                <View style={[styles.fileIconPlaceholder, { backgroundColor: Acid.mossDeep }]}>
                  <Feather name={getFileIcon()} size={24} color={Acid.good} />
                </View>
              )}
            </View>

            <View style={styles.fileInfo}>
              <Text style={[styles.fileName, { color: Acid.tx }]} numberOfLines={1}>
                {fileName}
              </Text>

              {(status === 'uploading' || status === 'analyzing') && (
                <>
                  <View style={[styles.progressBarContainer, { backgroundColor: Acid.mossDeep }]}>
                    <Animated.View
                      style={[
                        styles.progressBar,
                        {
                          width: status === 'analyzing' ? '100%' : progressAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ['0%', '100%'],
                          }),
                          backgroundColor: getStatusColor(),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: Acid.tx2 }]}>
                    {status === 'analyzing' ? 'Analyzing food items...' : `${progress}% - Uploading...`}
                  </Text>
                </>
              )}

              {status === 'completed' && (
                <>
                  <View style={[styles.progressBarContainer, { backgroundColor: Acid.mossDeep }]}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: '100%',
                          backgroundColor: getStatusColor(),
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.statusRow}>
                    <Feather name="check-circle" size={16} color={Acid.good} />
                    <Text style={[styles.statusMessage, { color: Acid.good }]}>
                      Upload successful
                    </Text>
                  </View>
                </>
              )}

              {status === 'failed' && (
                <>
                  <View style={[styles.progressBarContainer, { backgroundColor: Acid.mossDeep }]}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: '100%',
                          backgroundColor: getStatusColor(),
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.statusRow}>
                    <Feather name="alert-circle" size={16} color={Acid.error} />
                    <Text style={[styles.statusMessage, { color: Acid.error }]}>
                      {statusMessage || 'Error'}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.fileActions}>
              {(status === 'uploading' || status === 'analyzing') && (
                <TouchableOpacity onPress={onClose} style={styles.actionButton} disabled={status === 'analyzing'}>
                  <Feather name="x" size={20} color={Acid.tx2} />
                </TouchableOpacity>
              )}
              {status === 'failed' && onRetry && (
                <TouchableOpacity onPress={onRetry} style={styles.actionButton}>
                  <Feather name="refresh-cw" size={20} color={Acid.protein} />
                </TouchableOpacity>
              )}
            </View>
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
  uploadStatusSection: {
    flex: 1,
    padding: Spacing.lg,
  },
  statusText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.md,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  fileImage: {
    width: '100%',
    height: '100%',
  },
  fileIconPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.normal,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  statusMessage: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  fileActions: {
    marginLeft: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.xs,
  },
});


