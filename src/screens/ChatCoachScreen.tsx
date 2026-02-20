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
    SafeAreaView
} from 'react-native';
import { useTheme } from '../constants/theme';
import { Feather } from '@expo/vector-icons';
import { chatCoachService, ChatCoachContext } from '../services/chatCoachService';
import { getCoachChatResponse } from '../services/openaiService';

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

export const ChatCoachScreen: React.FC<ChatCoachScreenProps> = ({ onClose, isPremium = false }) => {
    const theme = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState<ChatCoachContext | null>(null);
    const [limitStatus, setLimitStatus] = useState({ allowed: true, remaining: 3 });
    const flatListRef = useRef<FlatList>(null);

    // Initial Load
    useEffect(() => {
        loadContextAndLimits();
    }, []);

    const loadContextAndLimits = async () => {
        try {
            setLoading(true);
            // 1. Get User Data Context
            const ctx = await chatCoachService.buildContext();
            setContext(ctx);

            // 2. Check Limits (Assume Free for now, or fetch user plan later. Hardcoded false for isPremium as requested default for now unless specified)
            // User said "this chat is for the premium only. the free option should allow only 3 questions perday."
            // I'll assume Free User by default for testing safety, or maybe I should check? 
            // For now, let's treat everyone as Free (3 limit) to prove the limit works, or Premium to prove text.
            // I will use 'false' (Free) default to test the limit logic.
            const limit = await chatCoachService.checkDailyLimit(isPremium);
            setLimitStatus(limit);

            // 3. Initial Greeting
            let initialMsg = "I'm ready to crunch the numbers. What's on your mind?";
            if (ctx.dataQuality === 'insufficient') {
                initialMsg = "Hold up! I notice we're light on data. I need more food logs and at least one weight entry to really help you out.";
            } else if (ctx.trends.weightTrend === 'down') {
                initialMsg = "Trends are looking good! You're dropping weight. How can I help you keep this momentum?";
            }

            setMessages([
                { id: 'init', role: 'assistant', content: initialMsg, createdAt: Date.now() }
            ]);

        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Could not load Coach connection.");
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;

        // 1. Limit Check
        const currentLimit = await chatCoachService.checkDailyLimit(isPremium);
        if (!currentLimit.allowed) {
            setLimitStatus(currentLimit); // Update UI
            return; // Block sending
        }

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputText.trim(), createdAt: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            // 2. Prepare History for AI
            // Only send last 6 messages to save tokens context
            const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
            history.push({ role: 'user', content: userMsg.content });

            // 3. Get Response
            const aiText = await getCoachChatResponse(history);

            const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: aiText, createdAt: Date.now() };
            setMessages(prev => [...prev, aiMsg]);

            // 4. Increment Usage
            await chatCoachService.incrementUsage();
            const newLimit = await chatCoachService.checkDailyLimit(isPremium);
            setLimitStatus(newLimit);

        } catch (e) {
            Alert.alert("Connection Error", "The coach is offline temporarily.");
        } finally {
            setLoading(false);
        }
    };

    const isInsufficient = context?.dataQuality === 'insufficient';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Journafied AI</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                        {limitStatus.remaining} messages left • History not saved
                    </Text>
                </View>
                <View style={{ width: 40 }} />
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
                    renderItem={({ item }) => (
                        <View style={[
                            styles.bubble,
                            item.role === 'user'
                                ? { alignSelf: 'flex-end', backgroundColor: theme.colors.primary }
                                : { alignSelf: 'flex-start', backgroundColor: theme.colors.secondaryBg }
                        ]}>
                            <Text style={[
                                styles.msgText,
                                item.role === 'user'
                                    ? { color: theme.colors.primaryForeground }
                                    : { color: theme.colors.textPrimary }
                            ]}>
                                {item.content}
                            </Text>
                        </View>
                    )}
                />

                {/* Loading Indicator */}
                {loading && (
                    <View style={{ padding: 10, alignItems: 'center' }}>
                        <ActivityIndicator color={theme.colors.primary} />
                    </View>
                )}

                {/* Input Area or Lock State */}
                {isInsufficient ? (
                    <View style={[styles.lockContainer, { backgroundColor: theme.colors.secondaryBg, borderTopColor: theme.colors.border }]}>
                        <Feather name="lock" size={20} color={theme.colors.textSecondary} style={{ marginBottom: 8 }} />
                        <Text style={[styles.lockTitle, { color: theme.colors.textPrimary }]}>Data Recharging</Text>
                        <Text style={[styles.lockSub, { color: theme.colors.textSecondary }]}>
                            Log food for ~7 days & verify weight to unlock Coach. We'll notify you!
                        </Text>
                    </View>
                ) : !limitStatus.allowed ? (
                    <View style={[styles.lockContainer, { backgroundColor: theme.colors.secondaryBg, borderTopColor: theme.colors.border }]}>
                        <Feather name="moon" size={20} color={theme.colors.textSecondary} style={{ marginBottom: 8 }} />
                        <Text style={[styles.lockTitle, { color: theme.colors.textPrimary }]}>Daily Limit Reached</Text>
                        <Text style={[styles.lockSub, { color: theme.colors.textSecondary }]}>
                            Refresh tomorrow for more wisdom.
                        </Text>
                    </View>
                ) : (
                    <View style={[styles.inputContainer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: theme.colors.background,
                                borderColor: theme.colors.border,
                                color: theme.colors.textPrimary
                            }]}
                            placeholder="Ask about your nutrition..."
                            placeholderTextColor={theme.colors.textTertiary}
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={handleSend}
                            returnKeyType="send"
                        />
                        <TouchableOpacity
                            onPress={handleSend}
                            disabled={loading || !inputText.trim()}
                            style={[
                                styles.sendBtn,
                                { backgroundColor: (loading || !inputText.trim()) ? theme.colors.border : theme.colors.primary }
                            ]}
                        >
                            <Feather name="arrow-up" size={20} color={theme.colors.primaryForeground} />
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
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
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center'
    },
    headerSubtitle: {
        fontSize: 12,
        textAlign: 'center'
    },
    bubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
    },
    msgText: {
        fontSize: 15,
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'center',
        borderTopWidth: 1,
    },
    input: {
        flex: 1,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        paddingHorizontal: 16,
        marginRight: 8,
        fontSize: 15,
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
        minHeight: 120,
        justifyContent: 'center'
    },
    lockTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4
    },
    lockSub: {
        fontSize: 13,
        textAlign: 'center',
        maxWidth: '80%'
    }
});
