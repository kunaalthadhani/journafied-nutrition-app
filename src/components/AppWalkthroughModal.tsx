import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';

const { width, height } = Dimensions.get('window');

interface WalkthroughModalProps {
    visible: boolean;
    onClose: (dontShowAgain: boolean) => void;
    onSignUp: (claimedOffer?: boolean) => void;
    hideOffer?: boolean;
}

const STEPS = [
    {
        id: '1',
        title: 'Just say it',
        description: 'Log meals in the easiest way.\nSay it out loud or type it naturally.',
        icon: 'mic',
    },
    {
        id: '2',
        title: 'Snap and track',
        description: 'Take a photo of your meal.\nWe identify ingredients and calculate calories.',
        icon: 'camera',
    },
    {
        id: '3',
        title: 'Your plan, built for you',
        description: 'Calories and macros are personalized using your age, body, and goals.\nThis keeps everything accurate.',
        icon: 'target',
    },
    {
        id: '4',
        title: 'See the trends',
        description: 'Track your weight and see how nutrition affects your progress over time.',
        icon: 'trending-up',
    },
    {
        id: '5',
        title: 'Adjusts as you go',
        description: 'Your targets update as you log meals to help you stay on track.',
        icon: 'sliders',
    },
    {
        id: '6',
        title: 'Personalized guidance',
        description: 'Get meal suggestions and feedback based on your plan.',
        icon: 'message-circle',
    },
    {
        id: '7',
        title: 'Build your plan',
        description: 'We’ll use a few details to personalize calories and goals.\nTakes about 2 minutes.',
        icon: 'play-circle',
        isFinal: true
    },
];

export const AppWalkthroughModal: React.FC<WalkthroughModalProps> = ({ visible, onClose, onSignUp, hideOffer }) => {
    const theme = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const flatListRef = useRef<FlatList>(null);

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
            flatListRef.current?.scrollToIndex({ index: 0, animated: false });
        }
    }, [visible]);

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
        onClose(dontShowAgain);
    };

    const handleSkip = () => {
        onClose(dontShowAgain);
    };

    const handleSignUpPress = () => {
        onClose(true); // Close and don't show again effectively
        onSignUp();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const listKey = React.useMemo(() => `walkthrough-${visible}-${hideOffer}`, [visible, hideOffer]);

    const renderItem = ({ item }: { item: typeof STEPS[0] }) => {
        const isFinal = item.isFinal;

        return (
            <View style={[styles.stepContainer, { width: width - 80 }]}>
                <View style={[styles.iconContainer, { backgroundColor: isFinal ? 'rgba(56, 189, 248, 0.1)' : theme.colors.background }]}>
                    <Feather name={item.icon as any} size={64} color={isFinal ? theme.colors.primary : theme.colors.primary} />
                </View>

                <Text style={[styles.title, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{item.title}</Text>
                <Text style={[styles.description, { color: theme.colors.textSecondary, textAlign: 'center' }]}>{item.description}</Text>

                {isFinal && (
                    <View style={{ width: '100%', marginTop: 32, gap: 16 }}>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }]}
                            onPress={handleSignUpPress}
                        >
                            <Text style={styles.buttonText}>Continue</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleFinish} style={{ padding: 12 }}>
                            <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', fontSize: 14 }}>Explore without a plan</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={handleFinish}
        >
            <View style={styles.container}>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>

                    {/* Header / Skip */}
                    <View style={styles.header}>
                        {currentIndex < filteredSteps.length - 1 && (
                            <TouchableOpacity onPress={handleSkip}>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>Skip</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Content Slider */}
                    <FlatList
                        ref={flatListRef}
                        key={listKey}
                        data={filteredSteps}
                        keyExtractor={(item) => item.id}
                        horizontal
                        pagingEnabled
                        scrollEnabled={false}
                        showsHorizontalScrollIndicator={false}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                        renderItem={renderItem}
                    />

                    {/* Footer Controls (Only show if NOT final slide) */}
                    {(!filteredSteps[currentIndex]?.isFinal) && (
                        <>
                            {/* Pagination Dots */}
                            <View style={styles.dotsContainer}>
                                {filteredSteps.map((_, index) => (
                                    <View
                                        key={index}
                                        style={[
                                            styles.dot,
                                            { backgroundColor: index === currentIndex ? theme.colors.primary : theme.colors.border }
                                        ]}
                                    />
                                ))}
                            </View>

                            <View style={styles.footer}>
                                {/* Don't Show Again Checkbox */}
                                <TouchableOpacity
                                    style={styles.checkboxRow}
                                    onPress={() => setDontShowAgain(!dontShowAgain)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.checkbox, { borderColor: theme.colors.border, backgroundColor: dontShowAgain ? theme.colors.primary : 'transparent' }]}>
                                        {dontShowAgain && <Feather name="check" size={14} color="white" />}
                                    </View>
                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginLeft: 8 }}>Don't show this again</Text>
                                </TouchableOpacity>

                                {/* Main Button */}
                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: theme.colors.primary }]}
                                    onPress={handleNext}
                                >
                                    <Text style={styles.buttonText}>
                                        {currentIndex === filteredSteps.length - 1 ? 'Got it' : 'Next'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
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
        width: width - 40,
        height: height * 0.75, // Taller for more content
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        width: '100%',
        height: 30, // Fixed height to prevent layout shift
        alignItems: 'flex-end',
        marginBottom: 10,
    },
    stepContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    footer: {
        width: '100%',
        gap: 16,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
