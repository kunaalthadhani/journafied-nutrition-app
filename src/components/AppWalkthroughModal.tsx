import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Dimensions,
    Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const ITEM_WIDTH = CARD_WIDTH - 48; // card padding = 24 each side

interface WalkthroughModalProps {
    visible: boolean;
    onClose: (dontShowAgain: boolean) => void;
    onSignUp: (claimedOffer?: boolean) => void;
    hideOffer?: boolean;
}

interface Step {
    id: string;
    title: string;
    tagline: string;
    description: string;
    icon: string;
    accent: string;
    accentBg: string;
    isFinal?: boolean;
}

const STEPS: Step[] = [
    {
        id: '1',
        title: 'Say it. Snap it. Done.',
        tagline: 'No typing required',
        description: '"Had 2 eggs and toast" — say it or type it, and we break down every calorie and macro instantly.',
        icon: 'mic',
        accent: '#3B82F6',
        accentBg: 'rgba(59, 130, 246, 0.12)',
    },
    {
        id: '2',
        title: 'Built around your body',
        tagline: 'Adapts as you progress',
        description: 'Your age, weight, and goals set your daily targets. As your body changes, your plan adapts automatically.',
        icon: 'target',
        accent: '#10B981',
        accentBg: 'rgba(16, 185, 129, 0.12)',
    },
    {
        id: '3',
        title: 'See what\'s really happening',
        tagline: 'Trends over time',
        description: 'Track weight trends, spot patterns, and understand how your meals affect your progress over weeks and months.',
        icon: 'trending-up',
        accent: '#F59E0B',
        accentBg: 'rgba(245, 158, 11, 0.12)',
    },
    {
        id: '4',
        title: 'Your AI nutrition coach',
        tagline: 'Answers based on your data',
        description: 'Ask anything — "Is my protein too low?" "What should I eat before a workout?" Get answers based on your actual data.',
        icon: 'message-circle',
        accent: '#8B5CF6',
        accentBg: 'rgba(139, 92, 246, 0.12)',
    },
    {
        id: '5',
        title: 'Let\'s build your plan',
        tagline: 'Takes about 2 minutes',
        description: 'We\'ll personalize your calories and goals based on a few details about you.',
        icon: 'play-circle',
        accent: '#06B6D4',
        accentBg: 'rgba(6, 182, 212, 0.12)',
        isFinal: true,
    },
];

export const AppWalkthroughModal: React.FC<WalkthroughModalProps> = ({ visible, onClose, onSignUp, hideOffer }) => {
    const theme = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;

    const filteredSteps = React.useMemo(() => {
        if (hideOffer) {
            return STEPS.filter(step => !step.isFinal);
        }
        return STEPS;
    }, [hideOffer]);

    // Reset index when opened
    useEffect(() => {
        if (visible) {
            setCurrentIndex(0);
            progressAnim.setValue(0);
            flatListRef.current?.scrollToIndex({ index: 0, animated: false });
        }
    }, [visible]);

    // Animate progress bar
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: (currentIndex + 1) / filteredSteps.length,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [currentIndex, filteredSteps.length]);

    const handleNext = () => {
        if (currentIndex < filteredSteps.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
        } else {
            handleFinish();
        }
    };

    const handleFinish = () => {
        onClose(true); // Auto-dismiss: always mark as seen
    };

    const handleSkip = () => {
        onClose(true); // Also mark as seen on skip
    };

    const handleSignUpPress = () => {
        onClose(true);
        onSignUp();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const listKey = React.useMemo(() => `walkthrough-${visible}-${hideOffer}`, [visible, hideOffer]);

    const renderItem = ({ item }: { item: Step }) => {
        const isFinal = item.isFinal;

        return (
            <View style={[styles.stepContainer, { width: ITEM_WIDTH }]}>
                {/* Accent icon */}
                <View style={[styles.iconContainer, { backgroundColor: item.accentBg }]}>
                    <Feather name={item.icon as any} size={48} color={item.accent} />
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{item.title}</Text>

                {/* Tagline */}
                <Text style={[styles.tagline, { color: item.accent }]}>{item.tagline}</Text>

                {/* Description */}
                <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{item.description}</Text>

                {/* Final card CTA buttons */}
                {isFinal && (
                    <View style={{ width: '100%', marginTop: 28, gap: 12 }}>
                        <TouchableOpacity
                            style={[styles.ctaButton, { backgroundColor: item.accent, shadowColor: item.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }]}
                            onPress={handleSignUpPress}
                        >
                            <Text style={styles.ctaButtonText}>Get Started</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleFinish} style={{ padding: 10 }}>
                            <Text style={{ color: theme.colors.textTertiary, textAlign: 'center', fontSize: 14 }}>Explore on my own</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const currentStep = filteredSteps[currentIndex];
    const isLastNonFinal = !currentStep?.isFinal && currentIndex === filteredSteps.length - 1;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={handleFinish}
        >
            <View style={styles.container}>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>

                    {/* Header: progress bar + skip */}
                    <View style={styles.header}>
                        {/* Progress bar */}
                        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                            <Animated.View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: currentStep?.accent || theme.colors.primary,
                                        width: progressAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0%', '100%'],
                                        }),
                                    },
                                ]}
                            />
                        </View>

                        {/* Skip link */}
                        {!currentStep?.isFinal && (
                            <TouchableOpacity onPress={handleSkip} style={styles.skipButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={{ color: theme.colors.textTertiary, fontSize: 13 }}>Skip</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Content Slider — swipe enabled */}
                    <FlatList
                        ref={flatListRef}
                        key={listKey}
                        data={filteredSteps}
                        keyExtractor={(item) => item.id}
                        horizontal
                        pagingEnabled
                        scrollEnabled={true}
                        showsHorizontalScrollIndicator={false}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                        renderItem={renderItem}
                        getItemLayout={(_, index) => ({
                            length: ITEM_WIDTH,
                            offset: ITEM_WIDTH * index,
                            index,
                        })}
                    />

                    {/* Footer: Next button (hidden on final card) */}
                    {!currentStep?.isFinal && (
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.nextButton, { backgroundColor: currentStep?.accent || theme.colors.primary }]}
                                onPress={handleNext}
                            >
                                <Text style={styles.nextButtonText}>
                                    {isLastNonFinal ? 'Done' : 'Next'}
                                </Text>
                                {!isLastNonFinal && <Feather name="arrow-right" size={18} color="white" style={{ marginLeft: 6 }} />}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: CARD_WIDTH,
        height: height * 0.55,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        width: '100%',
        marginBottom: 8,
        gap: 8,
    },
    progressTrack: {
        width: '100%',
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    skipButton: {
        alignSelf: 'flex-end',
    },
    stepContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 6,
    },
    tagline: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 14,
    },
    description: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    footer: {
        width: '100%',
        paddingTop: 8,
    },
    nextButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    nextButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    ctaButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    ctaButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
