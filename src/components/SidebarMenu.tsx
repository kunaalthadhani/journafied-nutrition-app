import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { useTheme } from '../constants/theme';

interface SidebarMenuProps {
  visible: boolean;
  onClose: () => void;
  onSetGoals: () => void;
  onWeightTracker?: () => void;
  onNutritionAnalysis?: () => void;
  onLogin?: () => void;
  onSettings?: () => void;
  onAbout?: () => void;
}

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  isBottom?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onPress, isActive, isBottom }) => {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.menuItem,
          isActive && { backgroundColor: theme.colors.accentBg },
          isBottom && styles.bottomMenuItem,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <Feather 
          name={icon as any} 
          size={20} 
          color="#14B8A6" 
        />
        <Text
          style={[
            styles.menuText,
            {
              color: isActive ? theme.colors.accent : theme.colors.textPrimary,
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  visible,
  onClose,
  onSetGoals,
  onWeightTracker,
  onNutritionAnalysis,
  onLogin,
  onSettings,
  onAbout,
}) => {
  const theme = useTheme();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.75;
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);
  
  // Initialize slideAnim with a default value, then update when dimensions are available
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.75 || -300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  
  // Update slide anim initial value when dimensions change
  useEffect(() => {
    const sidebarWidth = SCREEN_WIDTH * 0.75;
    if (!visible) {
      slideAnim.setValue(-sidebarWidth);
    }
  }, [SCREEN_WIDTH, visible]);
  
  const handleContainerLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0 && height !== containerHeight) {
      setContainerHeight(height);
    }
  };

  useEffect(() => {
    const sidebarWidth = SCREEN_WIDTH * 0.75;
    if (visible) {
      // Slide in smoothly
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out smoothly
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -sidebarWidth,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, SCREEN_WIDTH]);

  const handleSetGoals = () => {
    onSetGoals();
    onClose();
  };

  const handleWeightTracker = () => {
    onWeightTracker?.();
    onClose();
  };

  const handleNutritionAnalysis = () => {
    onNutritionAnalysis?.();
    onClose();
  };

  const handleLogin = () => {
    onLogin?.();
    onClose();
  };

  const handleSettings = () => {
    onSettings?.();
    onClose();
  };

  const handleAbout = () => {
    onAbout?.();
    onClose();
  };

  const overlayOpacity = overlayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container} onLayout={handleContainerLayout}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#000', opacity: overlayOpacity },
            ]}
          />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.sidebar,
            {
              width: SIDEBAR_WIDTH,
              height: containerHeight,
              backgroundColor: theme.colors.card,
              borderRightColor: theme.colors.border,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
                  Menu
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="x" size={24} color="#14B8A6" />
                </TouchableOpacity>
              </View>

              {/* Separator */}
              <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

              {/* Main Menu Items */}
              <View style={styles.menuSection}>
                <MenuItem
                  icon="target"
                  label="Set Goals"
                  onPress={handleSetGoals}
                />
                {/* Separator between Set Goals and Weight Tracker */}
                <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                <MenuItem
                  icon="trending-up"
                  label="Weight Tracker"
                  onPress={handleWeightTracker}
                />
                {/* Separator between Weight Tracker and Nutrition Analysis */}
                <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                <MenuItem
                  icon="bar-chart-2"
                  label="Nutrition Analysis"
                  onPress={handleNutritionAnalysis}
                />
              </View>
            </View>

            {/* Bottom Menu Items */}
            <View style={[styles.bottomSection, { borderTopColor: theme.colors.border }]}>
              <MenuItem icon="user" label="Account" onPress={handleLogin} isBottom />
              <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
              <MenuItem icon="settings" label="Settings" onPress={handleSettings} isBottom />
              <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
              <MenuItem icon="info" label="About" onPress={handleAbout} isBottom />
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    height: 64,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  closeButton: {
    padding: 4,
  },
  separator: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  menuSection: {
    paddingVertical: Spacing.xs,
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  menuText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  bottomSection: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  bottomMenuItem: {
    paddingVertical: Spacing.md,
  },
});

