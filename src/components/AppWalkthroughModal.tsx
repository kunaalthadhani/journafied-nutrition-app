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
    /** Two lines. The break is deliberate, it is what makes it read as a title. */
    title: string;
    body: string;
    /** The micro line under the demo. Says the honest part. */
    footer?: string;
    demo: 'log' | 'today' | 'label' | 'coach' | 'plan';
    isFinal?: boolean;
}

const STEPS: Step[] = [
    {
        id: '1',
        title: 'Say the meal.\nThat is the whole job.',
        body: 'Type it, speak it, or photograph it. No barcodes, no searching a database, no picking the closest wrong thing off a list.',
        footer: 'ONE SENTENCE IN · A FULL BREAKDOWN OUT',
        demo: 'log',
    },
    {
        id: '2',
        title: 'Home holds today.\nNothing else.',
        body: 'One number that matters, and the macros under it. Yesterday is settled and put away, tomorrow has not happened. Today is the only thing asking anything of you.',
        footer: 'YOUR TARGETS, FROM YOUR BODY AND YOUR GOAL',
        demo: 'today',
    },
    {
        id: '3',
        title: 'It reads the label.\nIt does not guess it.',
        body: 'Name a packaged product and it searches the web and the manufacturer database before answering. Photograph the panel and it copies the real figures straight off the pack.',
        footer: 'A LABEL BEATS AN ESTIMATE, EVERY TIME',
        demo: 'label',
    },
    {
        id: '4',
        title: 'A coach that has\nactually read your logs.',
        body: 'Ask it anything from day one. It answers from your food, your weight and your goal, and it tells you how many days it read that from rather than pretending to know more.',
        footer: 'IT NEVER REFUSES YOU FOR LACK OF DATA',
        demo: 'coach',
    },
    {
        id: '5',
        title: 'Let us build\nyour plan.',
        body: 'A few questions about your body and your goal, and you get the calorie and macro targets the rest of the app measures you against. Two minutes.',
        demo: 'plan',
        isFinal: true,
    },
];

// The demos show the product rather than describing it. Static on purpose: a
// walkthrough that animates is a walkthrough people wait through.
const Demo: React.FC<{ kind: Step['demo'] }> = ({ kind }) => {
    if (kind === 'log') {
        return (
            <View style={styles.demo}>
                <Text style={styles.demoInput}>2 eggs on toast and a flat white</Text>
                <View style={styles.demoRule} />
                {[['Scrambled eggs · 2', '182'], ['Sourdough toast · 1 slice', '120'], ['Flat white · regular', '96']].map(([a, b]) => (
                    <View key={a} style={styles.demoRow}>
                        <Text style={styles.demoName}>{a}</Text>
                        <Text style={styles.demoKcal}>{b}</Text>
                    </View>
                ))}
            </View>
        );
    }
    if (kind === 'today') {
        return (
            <View style={styles.demo}>
                <Text style={styles.demoBig}>1,438<Text style={styles.demoBigUnit}> kcal left</Text></Text>
                {[['PROTEIN', 0.62], ['CARBS', 0.44], ['FAT', 0.31]].map(([label, pct]) => (
                    <View key={label as string} style={{ marginTop: 12 }}>
                        <Text style={styles.demoMicro}>{label as string}</Text>
                        <View style={styles.demoTrack}>
                            <View style={[styles.demoFill, { width: `${(pct as number) * 100}%` }]} />
                        </View>
                    </View>
                ))}
            </View>
        );
    }
    if (kind === 'label') {
        return (
            <View style={styles.demo}>
                <Text style={styles.demoMicro}>YOU TYPED</Text>
                <Text style={styles.demoInput}>modern bakery high protein khaboos</Text>
                <View style={styles.demoRule} />
                <View style={styles.demoRow}>
                    <Text style={styles.demoName}>Protein, from the label</Text>
                    <Text style={styles.demoKcal}>46g</Text>
                </View>
                <View style={styles.demoRow}>
                    <Text style={[styles.demoName, { color: Acid.tx3 }]}>A guess would have said</Text>
                    <Text style={[styles.demoKcal, { color: Acid.tx3, textDecorationLine: 'line-through' }]}>24g</Text>
                </View>
            </View>
        );
    }
    if (kind === 'coach') {
        return (
            <View style={styles.demo}>
                <Text style={styles.demoAsk}>am i eating enough protein?</Text>
                <Text style={styles.demoReply}>
                    You are averaging 91g against a 150g target across your 6 logged days. That is the gap. Your usual chicken wrap twice a week would close most of it.
                </Text>
            </View>
        );
    }
    return (
        <View style={styles.demo}>
            {[['Your calorie target', 'from your body'], ['Your macro split', 'from your goal'], ['Your diet, if you follow one', 'keto, vegan, and more'], ['Everything premium', 'free for three weeks']].map(([a, b]) => (
                <View key={a} style={styles.demoRow}>
                    <Text style={styles.demoName}>{a}</Text>
                    <Text style={styles.demoKcal}>{b}</Text>
                </View>
            ))}
        </View>
    );
};

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

    const renderItem = ({ item, index }: { item: Step; index: number }) => (
        <View style={[styles.stepContainer, { width: ITEM_WIDTH }]}>
            <Text style={styles.counter}>
                HOW IT WORKS · {index + 1} OF {filteredSteps.length}
            </Text>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.body}</Text>

            <Demo kind={item.demo} />

            {!!item.footer && <Text style={styles.footerMicro}>{item.footer}</Text>}

            {item.isFinal && (
                <View style={{ width: '100%', marginTop: 28, gap: 12 }}>
                    <TouchableOpacity style={styles.ctaButton} onPress={handleSignUpPress}>
                        <Text style={styles.ctaButtonText}>Build my plan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleFinish} style={{ padding: 10 }}>
                        <Text style={{ color: Acid.tx3, textAlign: 'center', fontSize: 14 }}>Explore on my own</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

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
    counter: {
        fontSize: 11,
        letterSpacing: 1.6,
        color: Acid.limeDim,
        marginBottom: 18,
    },
    footerMicro: {
        fontSize: 10,
        letterSpacing: 1.4,
        color: Acid.tx3,
        marginTop: 18,
    },
    demo: {
        width: '100%',
        marginTop: 26,
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Acid.hair2,
        backgroundColor: Acid.mossDeep,
    },
    demoRule: { height: 1, backgroundColor: Acid.hair, marginVertical: 12 },
    demoRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 5 },
    demoName: { fontSize: 13, color: Acid.tx, flex: 1, marginRight: 12 },
    demoKcal: { fontSize: 13, color: Acid.tx2 },
    demoInput: { fontSize: 14, color: Acid.tx, lineHeight: 20 },
    demoMicro: { fontSize: 10, letterSpacing: 1.4, color: Acid.tx3, marginBottom: 6 },
    demoBig: { fontFamily: Acid.serif, fontSize: 36, color: Acid.tx },
    demoBigUnit: { fontFamily: undefined, fontSize: 13, color: Acid.tx3 },
    demoTrack: { height: 4, borderRadius: 2, backgroundColor: Acid.hair2, overflow: 'hidden', marginTop: 4 },
    demoFill: { height: 4, borderRadius: 2, backgroundColor: Acid.lime },
    demoAsk: { fontSize: 14, color: Acid.lime, textAlign: 'right', marginBottom: 14 },
    demoReply: { fontFamily: Acid.serifItalic, fontSize: 15, lineHeight: 23, color: Acid.tx },
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
