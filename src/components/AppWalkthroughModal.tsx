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
        description: 'tap the mic and say what you ate or just type it out naturally like texting a friend',
        icon: 'mic',
    },
    {
        id: '99',
        title: 'Quick Logs',
        description: 'save your favorite meals as quick prompts to log them in one tap next time',
        icon: 'bookmark',
    },
    {
        id: '2',
        title: 'Snap and track',
        description: 'take a photo of your meal and let ai identify ingredients and calculate calories instantly',
        icon: 'camera',
    },
    {
        id: '3',
        title: 'Full control',
        description: 'tap any food item to edit details or dive deep into nutritional breakdown',
        icon: 'edit-2',
    },
    {
        id: '4',
        title: 'See the trends',
        description: 'track your weight daily and visualize how your nutrition impacts your progress',
        icon: 'activity',
    },
    {
        id: '5',
        title: 'Unlimited Access',
        description: 'log as many meals as you want without restrictions',
        icon: 'unlock',
        isPremium: true
    },
    {
        id: '6',
        title: 'Smart suggestions',
        description: 'get intelligent meal recommendations based on your remaining macros',
        icon: 'zap',
        isPremium: true
    },
    {
        id: '7',
        title: 'Auto pilot',
        description: 'smart adjustments tweak your targets as you progress to prevent plateaus',
        icon: 'sliders',
        isPremium: true
    },
    {
        id: '8',
        title: 'Smart cart',
        description: 'your weekly grocery list curated automatically from your habits',
        icon: 'shopping-cart',
        isPremium: true
    },
    {
        id: '9',
        title: 'Personal Nutritionist',
        description: 'hyper personalized advice and real time feedback from your AI coach',
        icon: 'message-circle',
        isPremium: true
    },
    {
        id: '10',
        title: 'Start your journey',
        description: 'unlock the full experience free for 10 days by creating your account now',
        icon: 'star',
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
        const isPremium = item.isPremium;

        return (
            <View style={[styles.stepContainer, { width: width - 80 }]}>
                {isPremium && !isFinal && (
                    <View style={{ position: 'absolute', top: 0, alignItems: 'center', width: '100%' }}>
                        <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>PREMIUM</Text>
                        </View>
                    </View>
                )}

                <View style={[styles.iconContainer, { backgroundColor: isFinal ? 'rgba(255, 215, 0, 0.1)' : theme.colors.background }]}>
                    <Feather name={item.icon as any} size={64} color={isFinal ? '#FFD700' : theme.colors.primary} />
                </View>

                <Text style={[styles.title, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{item.title}</Text>
                <Text style={[styles.description, { color: theme.colors.textSecondary, textAlign: 'center' }]}>{item.description}</Text>

                {isFinal && (
                    <View style={{ width: '100%', marginTop: 32, gap: 16 }}>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }]}
                            onPress={handleSignUpPress}
                        >
                            <Text style={styles.buttonText}>Claim 10 Days Free</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleFinish} style={{ padding: 12 }}>
                            <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', fontSize: 14 }}>maybe later</Text>
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
