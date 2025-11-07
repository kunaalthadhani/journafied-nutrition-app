import React, { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../constants/theme';

interface TypingAnimationProps {
  children: string;
  speed?: number; // milliseconds per character
  style?: TextStyle;
  className?: string; // For NativeWind compatibility
}

export const TypingAnimation: React.FC<TypingAnimationProps> = ({
  children,
  speed = 30,
  style,
  className,
}) => {
  const theme = useTheme();
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!children) return;

    setDisplayText('');
    setIsComplete(false);
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < children.length) {
        setDisplayText(children.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [children, speed]);

  return (
    <Text
      style={[
        {
          color: theme.colors.textPrimary,
          fontFamily: 'monospace',
        },
        style,
      ]}
    >
      {displayText}
      {!isComplete && (
        <Text style={{ opacity: 0.5 }}>▊</Text> // Cursor
      )}
    </Text>
  );
};

