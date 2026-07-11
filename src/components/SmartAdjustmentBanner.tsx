
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';

interface SmartAdjustmentBannerProps {
    onPress: () => void;
    onClose: () => void;
    visible: boolean;
}

export const SmartAdjustmentBanner: React.FC<SmartAdjustmentBannerProps> = ({ onPress, onClose, visible }) => {    if (!visible) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[styles.container, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: Acid.lime }]}
        >
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: Acid.lime }]}>
                    <Feather name="activity" size={18} color="white" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.title, { color: Acid.tx }]}>Smart Plan Update Available</Text>
                    <Text style={[styles.subtitle, { color: Acid.tx2 }]}>Prevent plateaus with new targets</Text>
                </View>
            </View>

            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={18} color={Acid.tx3} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        gap: 2,
    },
    title: {
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.semiBold,
    },
    subtitle: {
        fontSize: Typography.fontSize.xs,
    },
});
