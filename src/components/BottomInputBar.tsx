import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface BottomInputBarProps {
  onSubmit?: (text: string) => void;
  onPlusPress?: () => void;
  placeholder?: string;
  isLoading?: boolean;
}

export const BottomInputBar: React.FC<BottomInputBarProps> = ({
  onSubmit,
  onPlusPress,
  placeholder = "What did you eat or exercise?",
  isLoading = false
}) => {
  const [text, setText] = React.useState('');

  const handleSubmit = () => {
    if (text.trim() && onSubmit && !isLoading) {
      onSubmit(text.trim());
      setText('');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardContainer}
    >
      <View style={styles.container}>
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.textInput, isLoading && styles.textInputDisabled]}
            placeholder={placeholder}
            placeholderTextColor={Colors.tertiaryText}
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            multiline={false}
            maxLength={200}
            editable={!isLoading}
          />
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={onPlusPress || handleSubmit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather 
              name="plus" 
              size={20} 
              color={Colors.secondaryText} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Account for iPhone home indicator
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    // Shadow for iOS
    shadowColor: Colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    // Shadow for Android
    elevation: 4,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
    color: Colors.primaryText,
    paddingVertical: 0, // Remove default padding
    marginRight: 12,
  },
  textInputDisabled: {
    color: Colors.tertiaryText,
    opacity: 0.6,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
});