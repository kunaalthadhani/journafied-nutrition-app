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
import { Acid } from '../constants/acid';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width;

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
    isFinal?: boolean;
}

const STEPS: Step[] = [
    {
        id: '1',
        title: 'Say it. Snap it. Done.',
        tagline: 'No typing required',
        description: '"Had 2 eggs and toast" — say it or type it, and we break down every calorie and macro instantly.',
        icon: 'mic',
    },
    {
        id: '2',
        title: 'Built around your body',
        tagline: 'Adapts as you progress',
        description: 'Your age, weight, and goals set your daily targets. As your body changes, your plan adapts automatically.',
        icon: 'target',
    },
    {
        id: '3',
        title: 'See what\'s really happening',
        tagline: 'Trends over time',
        description: 'Track weight trends, spot patterns, and understand how your meals affect your progress over weeks and months.',
        icon: 'trending-up',
    },
    {
        id: '4',
        title: 'Your AI Nutritionist',
        tagline: 'Answers based on your data',
        description: 'Ask anything — "Is my protein too low?" "What should I eat before a workout?" Get answers based on your actual data.',
        icon: 'message-circle',
    },
    {
        id: '5',
        title: 'Let\'s build your plan',
        tagline: 'Takes about 2 minutes',
        description: 'We\'ll personalize your calories and goals based on a few details about you.',
        icon: 'play-circle',
        isFinal: true,
    },
];

export const AppWalkthroughModal: React.FC<WalkthroughModalProps> = ({ visible, onClose, onSignUp, hideOffer }) => {
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
            const nextIndex = currentIndex + 1;
            // scrollToOffset is reliable on react-native-web (PWA);
            // scrollToIndex silently no-ops there when layout is racy.
            flatListRef.current?.scrollToOffset({
                offset: ITEM_WIDTH * nextIndex,
                animated: true,
            });
            // Update index immediately so progress bar moves even if the
            // onViewableItemsChanged callback is delayed by the scroll anim.
            setCurrentIndex(nextIndex);
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
                <Feather name={item.icon as any} size={34} color={Acid.lime} style={{ marginBottom: 28 }} />

                <Text style={styles.tagline}>{item.tagline.toUpperCase()}</Text>

                <Text style={styles.title}>{item.title}</Text>

                <Text style={styles.description}>{item.description}</Text>

                {/* Final card CTA buttons */}
                {isFinal && (
                    <View style={{ width: '100%', marginTop: 36, gap: 12 }}>
                        <TouchableOpacity
                            style={styles.ctaButton}
                            onPress={handleSignUpPress}
                        >
                            <Text style={styles.ctaButtonText}>Get Started</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleFinish} style={{ padding: 10 }}>
                            <Text style={{ color: Acid.tx3, textAlign: 'center', fontSize: 14 }}>Explore on my own</Text>
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
                {/* Header: progress bar + skip */}
                <View style={styles.header}>
                    <View style={styles.progressTrack}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progressAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%'],
                                    }),
                                },
                            ]}
                        />
                    </View>

                    {!currentStep?.isFinal && (
                        <TouchableOpacity onPress={handleSkip} style={styles.skipButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={{ color: Acid.tx3, fontSize: 13 }}>Skip</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Content Slider — swipe enabled.
                    Wrap in a fixed-width clipped view so RNW (PWA) does not
                    let neighbor slides peek. */}
                <View style={{ width: ITEM_WIDTH, overflow: 'hidden', flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        key={listKey}
                        data={filteredSteps}
                        keyExtractor={(item) => item.id}
                        horizontal
                        pagingEnabled
                        snapToInterval={ITEM_WIDTH}
                        snapToAlignment="start"
                        decelerationRate="fast"
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
                        style={{ width: ITEM_WIDTH }}
                    />
                </View>

                {/* Footer: Next button (hidden on final card) */}
                {!currentStep?.isFinal && (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.nextButton}
                            onPress={handleNext}
                        >
                            <Text style={styles.nextButtonText}>
                                {isLastNonFinal ? 'Done' : 'Next'}
                            </Text>
                            {!isLastNonFinal && <Feather name="arrow-right" size={18} color={Acid.moss} style={{ marginLeft: 6 }} />}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Acid.moss,
        paddingTop: 64,
        paddingBottom: 36,
    },
    header: {
        paddingHorizontal: 28,
        marginBottom: 8,
        gap: 12,
    },
    progressTrack: {
        width: '100%',
        height: 2,
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: Acid.hair2,
    },
    progressFill: {
        height: '100%',
        borderRadius: 1,
        backgroundColor: Acid.lime,
    },
    skipButton: {
        alignSelf: 'flex-end',
    },
    stepContainer: {
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 40,
    },
    tagline: {
        fontSize: 11,
        letterSpacing: 2,
        color: Acid.lime,
        marginBottom: 14,
    },
    title: {
        fontFamily: Acid.serifItalic,
        fontSize: 34,
        lineHeight: 42,
        color: Acid.tx,
        marginBottom: 16,
    },
    description: {
        fontSize: 15,
        lineHeight: 24,
        color: Acid.tx2,
        paddingRight: 16,
    },
    footer: {
        paddingHorizontal: 28,
        paddingTop: 8,
    },
    nextButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        backgroundColor: Acid.lime,
        shadowColor: Acid.lime,
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    nextButtonText: {
        color: Acid.moss,
        fontSize: 15,
        fontWeight: '700',
    },
    ctaButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 999,
        alignItems: 'center',
        backgroundColor: Acid.lime,
        shadowColor: Acid.lime,
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    ctaButtonText: {
        color: Acid.moss,
        fontSize: 15,
        fontWeight: '700',
    },
});
