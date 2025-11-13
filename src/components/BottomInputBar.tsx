import React, { useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { Spacing } from '../constants/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarVisualizer } from './BarVisualizer';

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
}) => {
  const [text, setText] = React.useState('');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = React.useRef(new Animated.Value(0)).current;
  const [inputHeight, setInputHeight] = React.useState(0);
  const calculatedInputHeight = Math.min(120, Math.max(28, inputHeight));
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);
  
  // Use transcribed text or manual text input
  const currentText = transcribedText || text;
  const hasText = currentText.trim().length > 0;

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
            <Feather name="plus" size={20} color="#14B8A6" />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: theme.colors.textPrimary, height: calculatedInputHeight, textAlign: (!isFocused && !hasText) ? 'center' : 'left', textAlignVertical: (!isFocused && !hasText) ? 'center' : 'top' }, (isLoading || isRecording || isTranscribing) && styles.textInputDisabled]}
            placeholder={(!isFocused && !hasText) ? placeholder : ''}
            placeholderTextColor={theme.colors.textTertiary}
            value={currentText}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmit}
            returnKeyType="default"
            multiline={true}
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
              <Feather 
                name="stop-circle" 
                size={18} 
                color={Colors.white} 
              />
              </TouchableOpacity>
            ) : (
              // Send or mic button
              <TouchableOpacity 
                style={[
                  styles.circleButton,
                  { backgroundColor: hasText ? '#14B8A6' : theme.colors.input }
                ]}
                onPress={hasText ? handleSubmit : onMicPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={isLoading || isTranscribing}
              >
                <Feather 
                  name={isTranscribing ? "loader" : hasText ? "send" : "mic"} 
                  size={18} 
                  color={hasText ? Colors.white : "#14B8A6"} 
                />
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
  textInputDisabled: {
    color: Colors.tertiaryText,
    opacity: 0.6,
  },
  recordingButton: {
    backgroundColor: Colors.error, // Red background when recording
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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