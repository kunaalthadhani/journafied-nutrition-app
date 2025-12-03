import React, { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
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
  const [isUserTyping, setIsUserTyping] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const heightUpdateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [inputHeight, setInputHeight] = React.useState(0);
  const inputRef = React.useRef<TextInput>(null);
  
  // FIXED: Memoize calculated values to prevent recalculation loops
  const calculatedInputHeight = React.useMemo(
    () => Math.min(150, Math.max(28, inputHeight)),
    [inputHeight]
  );
  
  // FIXED: Always use local text state - transcribedText only syncs when text is empty
  // This ensures user typing is always shown immediately
  const currentText = text;
  const hasText = currentText.trim().length > 0;
  const shouldShowChips = !hasText && quickPrompts.length > 0;
  // FIXED: Use native placeholder on Android to prevent glitching
  const showCustomPlaceholder = Platform.OS === 'ios' && !isFocused && !hasText;
  
  const singleLineThreshold = 40;
  const isMultiLine = calculatedInputHeight > singleLineThreshold;
  
  // FIXED: Use completely fixed values for single-line to prevent any recalculation
  const baseSingleLineHeight = 28; // Fixed base height for single line
  const fixedSingleLinePadding = Math.max(0, (baseSingleLineHeight - Typography.fontSize.md * 1.2) / 2);
  
  // FIXED: Calculate padding based on actual state, but use fixed value for placeholder
  const singleLinePadding = isMultiLine ? 0 : fixedSingleLinePadding;
  
  // FIXED: Placeholder uses completely fixed values that never change
  const placeholderTop = fixedSingleLinePadding;
  const placeholderLineHeight = baseSingleLineHeight - fixedSingleLinePadding * 2;
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
      setIsUserTyping(false);
      // Clear transcribed text if available
      if (onTranscribedTextChange) {
        onTranscribedTextChange('');
      }
      // Clear any pending typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };
  
  const handleTextChange = (newText: string) => {
    setText(newText);
    setIsUserTyping(true); // Mark that user is actively typing
    
    // FIXED: Debounce height calculation to prevent rapid updates
    if (heightUpdateTimeoutRef.current) {
      clearTimeout(heightUpdateTimeoutRef.current);
    }
    
    const newHeight = newText.length === 0 ? 0 : estimateHeightForText(newText);
    
    // FIXED: On Android, don't update height when empty to prevent style recalculation glitches
    if (newText.length === 0) {
      // Only update height on iOS when empty, Android keeps stable height
      if (Platform.OS === 'ios') {
        setInputHeight(0);
      }
      // On Android, don't update to prevent placeholder glitching
    } else if (Math.abs(newHeight - inputHeight) > 5) {
      // Use same threshold as onContentSizeChange for consistency
      setInputHeight(newHeight);
    } else {
      // For small changes, debounce the update
      heightUpdateTimeoutRef.current = setTimeout(() => {
        if (Math.abs(newHeight - inputHeight) > 1) {
          setInputHeight(newHeight);
        }
        heightUpdateTimeoutRef.current = null;
      }, 150);
    }
    
    if (newText.length > 0) {
      onUserTyping?.();
    }
    // Clear transcribed text when user starts typing
    if (transcribedText && onTranscribedTextChange) {
      onTranscribedTextChange('');
    }
    // Reset typing timeout - if user stops typing for 1 second, allow transcribed text
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsUserTyping(false);
      typingTimeoutRef.current = null;
    }, 1000);
  };

  // Sync transcribedText to local state when it changes (only if text is empty)
  useEffect(() => {
    // Only sync transcribedText if local text is completely empty
    if (text.length === 0 && transcribedText && transcribedText.trim().length > 0) {
      setText(transcribedText);
      // FIXED: Debounce height update for transcribed text to prevent jumps
      const newHeight = estimateHeightForText(transcribedText);
      if (Math.abs(newHeight - inputHeight) > 2) {
        setInputHeight(newHeight);
      }
    } else if (text.length === 0 && transcribedText && transcribedText.length === 0 && inputHeight > 0) {
      // Reset height if both are empty
      setInputHeight(0);
    }
  }, [transcribedText, estimateHeightForText, inputHeight, text.length]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (heightUpdateTimeoutRef.current) {
        clearTimeout(heightUpdateTimeoutRef.current);
      }
    };
  }, []);

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
    <View
      style={[
        styles.keyboardContainer,
        {
          backgroundColor: theme.colors.background,
          paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 20 : 12,
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

          <TouchableOpacity
            style={styles.inputFieldWrapper}
            activeOpacity={1}
            onPress={() => {
              // FIXED: Explicitly focus TextInput on Android when wrapper is tapped
              if (Platform.OS === 'android' && inputRef.current && !isLoading && !isRecording && !isTranscribing) {
                inputRef.current.focus();
              }
            }}
          >
            {showCustomPlaceholder && (
              <Text
                pointerEvents="none"
                style={[
                  styles.customPlaceholder,
                  {
                    color: theme.colors.textTertiary,
                    // FIXED: Use completely fixed values that never change
                    top: placeholderTop,
                    bottom: placeholderTop,
                    lineHeight: placeholderLineHeight,
                  },
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
                  // FIXED: Use fixed height on Android when empty to prevent placeholder glitching
                  height: Platform.OS === 'android' && !hasText 
                    ? baseSingleLineHeight  // Fixed height when empty on Android
                    : (calculatedInputHeight || baseSingleLineHeight),
                  lineHeight: !isMultiLine 
                    ? (Platform.OS === 'android' && !hasText
                        ? baseSingleLineHeight - fixedSingleLinePadding * 2  // Fixed lineHeight on Android when empty
                        : calculatedInputHeight - singleLinePadding * 2)
                    : undefined,
                  textAlignVertical: isMultiLine ? 'top' : 'center',
                  // FIXED: Use fixed padding on Android when empty to prevent glitching
                  paddingTop: Platform.OS === 'android' && !hasText 
                    ? fixedSingleLinePadding 
                    : singleLinePadding,
                  paddingBottom: Platform.OS === 'android' && !hasText 
                    ? fixedSingleLinePadding 
                    : singleLinePadding,
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
              blurOnSubmit={false}
              onFocus={() => {
                setIsFocused(true);
                // Keep user typing state when focused
                if (text.length > 0) {
                  setIsUserTyping(true);
                }
              }}
              onBlur={() => {
                setIsFocused(false);
                // Reset typing state after a short delay to allow transcribed text
                setTimeout(() => {
                  setIsUserTyping(false);
                }, 200);
              }}
              onContentSizeChange={(e) => {
                const newHeight = e.nativeEvent.contentSize.height;
                // FIXED: Only update if height change is significant (>5px) to prevent glitching
                // Also debounce to prevent rapid-fire updates
                if (heightUpdateTimeoutRef.current) {
                  clearTimeout(heightUpdateTimeoutRef.current);
                }
                if (Math.abs(newHeight - inputHeight) > 5) {
                  setInputHeight(newHeight);
                } else {
                  // Debounce small changes
                  heightUpdateTimeoutRef.current = setTimeout(() => {
                    if (Math.abs(newHeight - inputHeight) > 1) {
                      setInputHeight(newHeight);
                    }
                    heightUpdateTimeoutRef.current = null;
                  }, 150);
                }
              }}
              maxLength={200}
              editable={!isLoading && !isRecording && !isTranscribing}
              keyboardType="default"
              textContentType="none"
              autoCorrect={true}
              autoCapitalize="sentences"
              importantForAutofill="no"
              showSoftInputOnFocus={true}
              focusable={true}
              onPressIn={() => {
                // FIXED: Ensure focus on Android when TextInput is pressed directly
                if (Platform.OS === 'android' && inputRef.current && !isLoading && !isRecording && !isTranscribing) {
                  inputRef.current.focus();
                }
              }}
            />
          </TouchableOpacity>

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
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    width: '100%',
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
    position: 'relative',
    // FIXED: Allow touches to pass through to TextInput on Android
    ...(Platform.OS === 'android' && { pointerEvents: 'box-none' }),
  },
  customPlaceholder: {
    position: 'absolute',
    left: Spacing.sm,
    right: Spacing.sm,
    textAlign: 'center',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
    alignItems: 'center',
    justifyContent: 'center',
    // Prevent glitching by using stable positioning
    marginTop: 0,
    marginBottom: 0,
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
