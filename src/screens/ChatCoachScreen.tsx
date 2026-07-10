import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Modal,
    ScrollView,
} from 'react-native';
import { Acid } from '../constants/acid';
import { Feather } from '@expo/vector-icons';
import { chatCoachService, ChatCoachContext } from '../services/chatCoachService';
import { getCoachChatResponse } from '../services/openaiService';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
}

interface ChatCoachScreenProps {
    onClose?: () => void;
    isPremium?: boolean;
}

/**
 * Generates a proactive opening insight based on real user data.
 */
function buildOpeningInsight(ctx: ChatCoachContext): string {
    if (ctx.dataQuality === 'insufficient') {
        return "I need more data to give you useful advice. Keep logging meals and tracking weight, I'll be ready when you are.";
    }

    const parts: string[] = [];

    const { todaysLog, remainingMacros } = ctx;
    if (todaysLog.meals.length > 0) {
        parts.push(`You've eaten ${todaysLog.totalCalories} cal today across ${todaysLog.meals.length} meal${todaysLog.meals.length > 1 ? 's' : ''}.`);
        if (remainingMacros.calories > 200) {
            parts.push(`${remainingMacros.calories} cal remaining.`);
        } else if (remainingMacros.calories > 0) {
            parts.push('Almost at your target.');
        } else {
            parts.push('You have hit your calorie goal for today.');
        }
    } else {
        parts.push("No meals logged today yet.");
    }

    if (remainingMacros.protein > 20 && todaysLog.meals.length > 0) {
        parts.push(`You still need ${remainingMacros.protein}g protein.`);
    }

    if (ctx.trends.weightTrend === 'down') {
        parts.push("Weight trending down. Keep it up.");
    } else if (ctx.trends.weightTrend === 'up' && ctx.userProfile.goalType === 'lose_weight') {
        parts.push("Weight is trending up, worth reviewing this week's intake.");
    }

    if (ctx.trends.consistencyScore < 50 && ctx.trends.streakDays < 3) {
        parts.push("Consistency has dipped. Even rough estimates help.");
    }

    parts.push("Ask me anything about your nutrition.");

    return parts.join(' ');
}

/**
 * Builds two context-aware starter questions based on user data.
 */
function buildStarterQuestions(ctx: ChatCoachContext | null): string[] {
    if (!ctx || ctx.dataQuality === 'insufficient') {
        return [];
    }

    const q1 = ctx.todaysLog.meals.length > 0
        ? "Am I on track with my goals today?"
        : "How did I do with my nutrition this week?";

    const q2 = ctx.userProfile.goalType === 'lose_weight'
        ? "What can I improve to lose weight faster?"
        : ctx.userProfile.goalType === 'gain_muscle'
            ? "Am I eating enough to build muscle?"
            : "What should I eat for my next meal?";

    return [q1, q2];
}

export const ChatCoachScreen: React.FC<ChatCoachScreenProps> = ({ onClose, isPremium = false }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState<ChatCoachContext | null>(null);
    const [limitStatus, setLimitStatus] = useState({ allowed: true, remaining: 3 });
    const [showInfo, setShowInfo] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    // Synchronous re-entry guard. `loading` is React state and updates a tick
    // late, so a fast double tap (or a starter-question tap mid send) could fire
    // two requests before the button disables. This blocks the second one.
    const sendingRef = useRef(false);

    const starterQuestions = buildStarterQuestions(context);
    const showStarters = messages.length <= 1 && !loading && starterQuestions.length > 0;

    useEffect(() => {
        loadContextAndLimits();
    }, []);

    const loadContextAndLimits = async () => {
        try {
            setLoading(true);
            const ctx = await chatCoachService.buildContext();
            setContext(ctx);

            const limit = await chatCoachService.checkDailyLimit(isPremium);
            setLimitStatus(limit);

            const initialMsg = buildOpeningInsight(ctx);

            setMessages([
                { id: 'init', role: 'assistant', content: initialMsg, createdAt: Date.now() }
            ]);

        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Could not load AI Nutritionist.");
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (overrideText?: string) => {
        if (sendingRef.current) return;
        const textToSend = overrideText || inputText.trim();
        if (!textToSend) return;

        sendingRef.current = true;
        try {
            const currentLimit = await chatCoachService.checkDailyLimit(isPremium);
            if (!currentLimit.allowed) {
                setLimitStatus(currentLimit);
                return;
            }

            const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, createdAt: Date.now() };
            setMessages(prev => [...prev, userMsg]);
            setInputText('');
            setLoading(true);

            const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
            history.push({ role: 'user', content: userMsg.content });

            const result = await getCoachChatResponse(history);

            const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: result.text, createdAt: Date.now() };
            setMessages(prev => [...prev, aiMsg]);

            // Only spend a message when the coach actually answered. A network
            // failure or an empty completion shows the fallback for free.
            if (result.ok) {
                await chatCoachService.incrementUsage();
                const newLimit = await chatCoachService.checkDailyLimit(isPremium);
                setLimitStatus(newLimit);
            }
        } catch (e) {
            Alert.alert("Connection Error", "AI Nutritionist is offline temporarily.");
        } finally {
            setLoading(false);
            sendingRef.current = false;
        }
    };

    const isInsufficient = context?.dataQuality === 'insufficient';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Acid.moss }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: Acid.hair }]}>
                <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                    <Feather name="chevron-down" size={24} color={Acid.tx2} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>AI Nutritionist</Text>
                    <Text style={styles.headerSubtitle}>
                        {limitStatus.remaining} messages left
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerBtn}>
                    <Feather name="info" size={20} color={Acid.tx3} />
                </TouchableOpacity>
            </View>

            {/* Chat Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListFooterComponent={showStarters ? (
                        <View style={styles.starterContainer}>
                            {starterQuestions.map((q, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={styles.starterChip}
                                    onPress={() => handleSend(q)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.starterText}>{q}</Text>
                                    <Feather name="arrow-up-right" size={14} color={Acid.lime} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}
                    renderItem={({ item }) => (
                        // The coach speaks in the serif voice, no bubbles. The user's
                        // words sit right-aligned in the accent.
                        item.role === 'user' ? (
                            <View style={styles.userMsg}>
                                <Text style={styles.userText}>{item.content}</Text>
                            </View>
                        ) : (
                            <View style={styles.coachMsg}>
                                <Text style={styles.coachText}>{item.content}</Text>
                            </View>
                        )
                    )}
                />

                {loading && (
                    <View style={{ padding: 10, alignItems: 'center' }}>
                        <ActivityIndicator color={Acid.lime} />
                    </View>
                )}

                {/* Input Area or Lock State */}
                {isInsufficient ? (
                    <View style={styles.lockContainer}>
                        <Feather name="lock" size={20} color={Acid.tx3} style={{ marginBottom: 8 }} />
                        <Text style={styles.lockTitle}>AI Nutritionist Locked</Text>
                        <Text style={styles.lockSub}>
                            Log meals for 14 days and track your weight to unlock the AI Nutritionist. The more data you log, the smarter it gets.
                        </Text>
                    </View>
                ) : !limitStatus.allowed ? (
                    <View style={styles.lockContainer}>
                        <Feather name="moon" size={20} color={Acid.tx3} style={{ marginBottom: 8 }} />
                        <Text style={styles.lockTitle}>Daily Limit Reached</Text>
                        <Text style={styles.lockSub}>
                            Refresh tomorrow for more wisdom.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Ask about your nutrition..."
                            placeholderTextColor={Acid.tx3}
                            selectionColor={Acid.lime}
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={() => handleSend()}
                            returnKeyType="send"
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={() => handleSend()}
                            disabled={loading || !inputText.trim()}
                            style={[
                                styles.sendBtn,
                                { backgroundColor: (loading || !inputText.trim()) ? Acid.hair2 : Acid.lime }
                            ]}
                        >
                            <Feather name="arrow-up" size={20} color={(loading || !inputText.trim()) ? Acid.tx3 : Acid.moss} />
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* Info Modal */}
            <Modal
                visible={showInfo}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowInfo(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: Acid.moss }}>
                    <View style={[styles.infoHeader, { borderBottomColor: Acid.hair }]}>
                        <View style={styles.headerBtn} />
                        <Text style={styles.headerTitle}>About AI Nutritionist</Text>
                        <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.headerBtn}>
                            <Feather name="x" size={22} color={Acid.tx2} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.infoContent}>
                        <Text style={styles.infoSectionTitle}>What is the AI Nutritionist?</Text>
                        <Text style={styles.infoBody}>
                            The AI Nutritionist is your personal AI nutrition assistant. It reads your logged meals, weight trend, macro averages, and the foods you actually eat to give you advice that is specific to you, not generic tips you could find anywhere online.
                        </Text>
                        <Text style={styles.infoBody}>
                            You can ask it things like "Am I eating enough protein?", "What should I have for dinner?", or "Why is my weight not changing?" and it will answer using your real data. It will only suggest foods it has seen in your meal history, so you will never get recommendations for things you do not eat.
                        </Text>
                        <Text style={styles.infoBody}>
                            The more consistently you log, the better it gets. It uses your last 14 days of data to understand your patterns, which is why it requires 14 days of logging before it unlocks.
                        </Text>

                        <View style={styles.infoDivider} />

                        <Text style={styles.infoSectionTitle}>Important Disclaimer</Text>
                        <Text style={styles.infoBody}>
                            The AI Nutritionist is powered by AI and its responses are estimates based on the data you provide. It is not always 100% accurate.
                        </Text>
                        <Text style={styles.infoBody}>
                            It does not currently account for food allergies, intolerances, or medical conditions. If you have specific dietary restrictions or health concerns, please consult a qualified healthcare professional or registered dietitian before making changes to your diet.
                        </Text>
                        <Text style={styles.infoBody}>
                            This feature is not a substitute for professional medical or nutritional advice.
                        </Text>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        borderBottomWidth: 1,
        paddingHorizontal: 8
    },
    headerBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: Acid.serifItalic,
        fontSize: 19,
        color: Acid.tx,
        textAlign: 'center'
    },
    headerSubtitle: {
        fontSize: Typography.fontSize.xs,
        color: Acid.tx3,
        textAlign: 'center'
    },
    starterContainer: {
        marginTop: Spacing.md,
    },
    starterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Acid.hair,
    },
    starterText: {
        fontSize: Typography.fontSize.sm,
        color: Acid.tx2,
        flex: 1,
        marginRight: Spacing.sm,
    },
    coachMsg: {
        maxWidth: '92%',
        alignSelf: 'flex-start',
        marginBottom: 20,
    },
    coachText: {
        fontFamily: Acid.serifItalic,
        fontSize: 17,
        lineHeight: 26,
        color: Acid.tx,
    },
    userMsg: {
        maxWidth: '80%',
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    userText: {
        fontSize: 15,
        lineHeight: 22,
        color: Acid.lime,
        textAlign: 'right',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: Acid.hair,
        backgroundColor: Acid.moss,
    },
    input: {
        flex: 1,
        height: 44,
        paddingHorizontal: 8,
        marginRight: 8,
        fontSize: 15,
        color: Acid.tx,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockContainer: {
        padding: 24,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: Acid.hair,
        minHeight: 120,
        justifyContent: 'center'
    },
    lockTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.semiBold,
        color: Acid.tx,
        marginBottom: 4
    },
    lockSub: {
        fontSize: Typography.fontSize.sm,
        color: Acid.tx2,
        textAlign: 'center',
        maxWidth: '80%'
    },
    // Info modal styles
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        borderBottomWidth: 1,
        paddingHorizontal: 8,
    },
    infoContent: {
        padding: Spacing.lg,
        paddingBottom: 60,
    },
    infoSectionTitle: {
        fontSize: Typography.fontSize.md,
        fontWeight: Typography.fontWeight.semiBold,
        color: Acid.tx,
        marginBottom: Spacing.sm,
    },
    infoBody: {
        fontSize: Typography.fontSize.sm,
        lineHeight: Typography.fontSize.sm * 1.6,
        color: Acid.tx2,
        marginBottom: Spacing.md,
    },
    infoDivider: {
        height: 1,
        backgroundColor: Acid.hair,
        marginVertical: Spacing.lg,
    },
});
