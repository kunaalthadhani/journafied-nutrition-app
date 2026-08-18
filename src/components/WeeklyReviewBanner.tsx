import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';

interface WeeklyReviewBannerProps {
    visible: boolean;
    onPress: () => void;
    onDismiss: () => void;
}

export const WeeklyReviewBanner: React.FC<WeeklyReviewBannerProps> = ({ visible, onPress, onDismiss }) => {
    if (!visible) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={styles.container}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Feather name="sunrise" size={17} color={Acid.moss} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>Your week is in</Text>
                    <Text style={styles.subtitle}>Read what changed since last week</Text>
                </View>
            </View>

            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
        borderColor: Acid.hair2,
        backgroundColor: Acid.limeSoft,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconContainer: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: Acid.lime,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        gap: 2,
        flex: 1,
    },
    title: {
        fontFamily: Acid.serifItalic,
        fontSize: 16,
        color: Acid.tx,
    },
    subtitle: {
        fontSize: Typography.fontSize.xs,
        color: Acid.tx2,
    },
});
