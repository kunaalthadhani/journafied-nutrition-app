import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';

interface PremiumBlurredContentProps {
    children: React.ReactNode;
    onUnlockPress: () => void;
    height?: number;
}

/**
 * Reusable component for displaying blurred premium content
 * Shows a lock overlay with "Unlock Premium" CTA
 */
export const PremiumBlurredContent: React.FC<PremiumBlurredContentProps> = ({
    children,
    onUnlockPress,
    height = 100
}) => {
    const theme = useTheme();

    return (
        <View style={[styles.container, { height }]}>
            {/* Blurred Background Content */}
            <View style={[styles.blurredContent, { opacity: 0.3 }]}>
                {children}
            </View>

            {/* Blur Overlay */}
            {Platform.OS !== 'web' && (
                <BlurView
                    intensity={20}
                    tint={theme.mode === 'dark' ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                />
            )}

            {/* Lock Overlay */}
            <View style={[styles.lockOverlay, Platform.OS === 'web' && styles.webBlur]}>
                <View style={[styles.lockIcon, { backgroundColor: theme.colors.primary }]}>
                    <Feather name="lock" size={20} color="white" />
                </View>

                <Text style={[styles.lockText, { color: theme.colors.textPrimary }]}>
                    Premium Feature
                </Text>

                <TouchableOpacity
                    style={[styles.unlockButton, { backgroundColor: theme.colors.primary }]}
                    onPress={onUnlockPress}
                >
                    <Feather name="unlock" size={14} color="white" style={{ marginRight: 6 }} />
                    <Text style={styles.unlockButtonText}>Unlock Premium</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
    },
    blurredContent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    lockOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    webBlur: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
    },
    lockIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockText: {
        fontSize: Typography.fontSize.md,
        fontWeight: Typography.fontWeight.semiBold,
    },
    unlockButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    unlockButtonText: {
        color: 'white',
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.semiBold,
    },
});
