import React, { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  Animated,
  Easing,
  Platform,
  ScrollView,
} from 'react-native';
import { Plus, Mic, Send, Loader, StopCircle, X } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { Spacing } from '../constants/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarVisualizer } from './BarVisualizer';

interface QuickPrompt {
  id: string;
  text: string;
}

interface BottomInputBarProps {
  onSubmit?: (text: string) => void;
  onPlusPress?: () => void;
  onMicPress?: () => void;
  placeholder?: string;
  isLoading?: boolean;
  isRecording?: boolean;
  transcribedText?: string;
  onTranscribedTextChange?: (text: string) => void;
  isTranscribing?: boolean;
  onUserTyping?: () => void;
  autoFocus?: boolean;
  quickPrompts?: QuickPrompt[];
  onQuickPromptPress?: (prompt: QuickPrompt) => void;
  onQuickPromptRemove?: (id: string) => void;
}

export const BottomInputBar: React.FC<BottomInputBarProps> = ({
  onSubmit,
  onPlusPress,
  onMicPress,
  placeholder = "What did you eat or exercise?",
  isLoading = false,
  isRecording = false,
  transcribedText = '',
  onTranscribedTextChange,
  isTranscribing = false,
  onUserTyping,
  autoFocus = false,
  quickPrompts = [],
  onQuickPromptPress,
  onQuickPromptRemove,
}) => {
  const [text, setText] = React.useState('');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = React.useRef(new Animated.Value(0)).current;
  const [inputHeight, setInputHeight] = React.useState(0);
  const calculatedInputHeight = Math.min(150, Math.max(28, inputHeight));
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);
  
  // Use transcribed text or manual text input
  const currentText = transcribedText || text;
  const hasText = currentText.trim().length > 0;
  const shouldShowChips = !hasText && quickPrompts.length > 0;
  const showCustomPlaceholder = !isFocused && !hasText;
  const singleLineThreshold = 40;
  const isMultiLine = calculatedInputHeight > singleLineThreshold;
  const singleLinePadding = !isMultiLine
    ? Math.max(0, (calculatedInputHeight - Typography.fontSize.md * 1.2) / 2)
    : 0;
  const estimateHeightForText = React.useCallback((value: string) => {
    const trimmed = value?.trim() || '';
    if (!trimmed.length) return 0;
    const approxCharsPerLine = 36;
    const lineHeight = Typography.fontSize.md * 1.4;
    const lineCount = trimmed.split('\n').reduce((count, line) => {
      const segments = Math.max(1, Math.ceil(line.length / approxCharsPerLine));
      return count + segments;
    }, 0);
    return Math.min(150, Math.max(28, lineCount * lineHeight + 12));
  }, []);

  const handleSubmit = () => {
    if (currentText.trim() && onSubmit && !isLoading && !isRecording && !isTranscribing) {
      onSubmit(currentText.trim());
      setText('');
      // Clear transcribed text if available
      if (onTranscribedTextChange) {
        onTranscribedTextChange('');
      }
    }
  };
  
  const handleTextChange = (newText: string) => {
    setText(newText);
    setInputHeight(newText.length === 0 ? 0 : estimateHeightForText(newText));
    if (newText.length > 0) {
      onUserTyping?.();
    }
    // Clear transcribed text when user starts typing
    if (transcribedText && onTranscribedTextChange) {
      onTranscribedTextChange('');
    }
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const keyboardHeight = event?.endCoordinates?.height ?? 0;
      const offset = keyboardHeight - insets.bottom;
      Animated.timing(translateY, {
        toValue: -offset,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, translateY]);

  useEffect(() => {
    setInputHeight(transcribedText.length === 0 ? 0 : estimateHeightForText(transcribedText));
  }, [transcribedText, estimateHeightForText]);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay to ensure the component is mounted
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  return (
    <Animated.View
      style={[
        styles.keyboardContainer,
        {
          backgroundColor: theme.colors.background,
          paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 20 : 12,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.container}>
        {shouldShowChips && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipScrollContent}
          >
            {quickPrompts.map((prompt) => (
              <View
                key={prompt.id}
                style={[styles.quickPromptChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <TouchableOpacity
                  onPress={() => onQuickPromptPress?.(prompt)}
                  disabled={isLoading || isRecording || isTranscribing}
                  style={styles.quickPromptTextWrapper}
                >
                  <Text
                    style={[styles.quickPromptText, { color: theme.colors.textPrimary }]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {prompt.text.trim()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onQuickPromptRemove?.(prompt.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.quickPromptRemove}
                >
                  <X size={14} color={theme.colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        {isRecording && (
          <View style={[styles.visualizerContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <BarVisualizer
              state="listening"
              barCount={20}
              minHeight={15}
              maxHeight={60}
            />
          </View>
        )}
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
          <TouchableOpacity 
            onPress={onPlusPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={isLoading || isRecording || isTranscribing}
            style={styles.plusIconButton}
          >
            <Plus color="#10B981" size={20} strokeWidth={2.6} />
          </TouchableOpacity>

          <View style={styles.inputFieldWrapper}>
            {showCustomPlaceholder && (
              <Text
                pointerEvents="none"
                style={[
                  styles.customPlaceholder,
                  { color: theme.colors.textTertiary },
                ]}
              >
                {placeholder}
              </Text>
            )}
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                {
                  color: theme.colors.textPrimary,
                  height: calculatedInputHeight,
                  lineHeight: !isMultiLine ? calculatedInputHeight - singleLinePadding * 2 : undefined,
                  textAlignVertical: isMultiLine ? 'top' : 'center',
                  paddingTop: singleLinePadding,
                  paddingBottom: singleLinePadding,
                },
                (isLoading || isRecording || isTranscribing) && styles.textInputDisabled,
              ]}
              placeholder={showCustomPlaceholder ? '' : placeholder}
              placeholderTextColor={theme.colors.textTertiary}
              value={currentText}
              onChangeText={handleTextChange}
              onSubmitEditing={handleSubmit}
              returnKeyType="default"
              multiline={true}
              scrollEnabled={false}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onContentSizeChange={(e) => {
                const newHeight = e.nativeEvent.contentSize.height;
                if (newHeight !== inputHeight) {
                  setInputHeight(newHeight);
                }
              }}
              maxLength={200}
              editable={!isLoading && !isRecording && !isTranscribing}
            />
          </View>

          <View style={styles.rightControls}>
            {isRecording ? (
              // Stop recording button
              <TouchableOpacity 
                style={[
                  styles.circleButton,
                  { backgroundColor: theme.colors.error }
                ]}
                onPress={onMicPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={isLoading || isTranscribing}
              >
              <StopCircle size={18} color={Colors.white} strokeWidth={2.6} />
              </TouchableOpacity>
            ) : (
              // Send or mic button
              <TouchableOpacity 
                style={[
                  styles.circleButton,
                  { backgroundColor: hasText ? '#10B981' : theme.colors.input }
                ]}
                onPress={hasText ? handleSubmit : onMicPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={isLoading || isTranscribing}
              >
                {isTranscribing ? (
                  <Loader size={18} color={hasText ? Colors.white : '#10B981'} strokeWidth={2.6} />
                ) : hasText ? (
                  <Send size={18} color={Colors.white} strokeWidth={2.6} />
                ) : (
                  <Mic size={18} color="#10B981" strokeWidth={2.6} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: 'transparent',
    paddingTop: 8,
  },
  chipScroll: {
    maxHeight: 80,
    marginBottom: 8,
  },
  chipScrollContent: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  quickPromptChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  quickPromptTextWrapper: {
    flexShrink: 1,
    marginRight: 6,
    maxWidth: 220,
  },
  quickPromptText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: Typography.fontSize.sm * 1.4,
  },
  quickPromptRemove: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 56,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  leftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginRight: Spacing.sm,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
    color: Colors.primaryText,
    paddingVertical: 0, // Remove default padding
    paddingHorizontal: Spacing.sm,
  },
  inputFieldWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  customPlaceholder: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
    paddingHorizontal: Spacing.sm,
  },
  textInputDisabled: {
    color: Colors.tertiaryText,
    opacity: 0.6,
  },
  recordingButton: {
    backgroundColor: Colors.error, // Red background when recording
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  micButton: {
    padding: Spacing.xs,
  },
  visualizerContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  sendBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIconButton: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
  },
});
