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
  placeholder = "Describe your meal",
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
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = React.useRef<TextInput>(null);

  const currentText = text;
  const hasText = currentText.trim().length > 0;
  const shouldShowChips = !hasText && quickPrompts.length > 0;
  const showCustomPlaceholder = Platform.OS === 'ios' && !isFocused && !hasText;

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
    setIsUserTyping(true);

    if (newText.length > 0) {
      onUserTyping?.();
    }
    if (transcribedText && onTranscribedTextChange) {
      onTranscribedTextChange('');
    }
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
    if (text.length === 0 && transcribedText && transcribedText.trim().length > 0) {
      setText(transcribedText);
    }
  }, [transcribedText, text.length]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
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
          paddingBottom: Platform.OS === 'ios'
            ? (insets.bottom > 0 ? insets.bottom : 20)
            : 5,
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
            <Plus color={theme.colors.textPrimary} size={20} strokeWidth={2.4} />
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
              <View style={styles.placeholderContainer} pointerEvents="none">
                <Text style={[styles.customPlaceholder, { color: '#B0B0B0' }]}>
                  {placeholder}
                </Text>
              </View>
            )}
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                {
                  color: theme.colors.textPrimary,
                },
                (isLoading || isRecording || isTranscribing) && styles.textInputDisabled,
              ]}
              placeholder={showCustomPlaceholder ? '' : placeholder}
              placeholderTextColor="#B0B0B0"
              value={currentText}
              onChangeText={handleTextChange}
              onSubmitEditing={handleSubmit}
              returnKeyType="default"
              multiline={true}
              scrollEnabled={true}
              blurOnSubmit={false}
              onFocus={() => {
                setIsFocused(true);
                if (text.length > 0) {
                  setIsUserTyping(true);
                }
              }}
              onBlur={() => {
                setIsFocused(false);
                setTimeout(() => {
                  setIsUserTyping(false);
                }, 200);
              }}
              maxLength={500}
              editable={!isLoading && !isRecording && !isTranscribing}
              keyboardType="default"
              textContentType="none"
              autoCorrect={true}
              autoCapitalize="sentences"
              importantForAutofill="no"
              showSoftInputOnFocus={true}
              focusable={true}
              onPressIn={() => {
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
                <StopCircle size={18} color={theme.colors.background} strokeWidth={2.4} />
              </TouchableOpacity>
            ) : (
              // Send or mic button
              <TouchableOpacity
                style={[
                  styles.circleButton,
                  { backgroundColor: hasText ? theme.colors.primary : theme.colors.input }
                ]}
                onPress={hasText ? handleSubmit : onMicPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={isLoading || isTranscribing}
              >
                {isTranscribing ? (
                  <Loader size={18} color={hasText ? theme.colors.background : theme.colors.textSecondary} strokeWidth={2.4} />
                ) : hasText ? (
                  <Send size={18} color={theme.colors.background} strokeWidth={2.4} />
                ) : (
                  <Mic size={18} color={theme.colors.textPrimary} strokeWidth={2.4} />
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8, // Shadcn style: slightly rounded
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
    padding: 2,
    opacity: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 52,
    borderWidth: 1,
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
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    minHeight: 36,
    maxHeight: 120,
    textAlignVertical: 'center',
  },
  inputFieldWrapper: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'android' && { pointerEvents: 'box-none' }),
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    paddingLeft: Spacing.sm, // Align with input text
  },
  customPlaceholder: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
  },
  textInputDisabled: {
    opacity: 0.6,
  },
  recordingButton: {
    // backgroundColor set inline via theme
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 8, // Rounded square for buttons often in shadcn, or full circle. Let's stick to circle for action buttons.
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});
