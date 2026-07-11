import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../constants/typography';
import { Acid } from '../constants/acid';
import { feedbackService, FeedbackCategory } from '../services/feedbackService';

interface FeedbackModalProps {
    visible: boolean;
    onClose: () => void;
}

const CATEGORIES: Array<{ key: FeedbackCategory; label: string; icon: keyof typeof Feather.glyphMap; description: string }> = [
    { key: 'bug', label: 'Bug', icon: 'alert-circle', description: 'Something broke or behaves wrong' },
    { key: 'idea', label: 'Idea', icon: 'zap', description: 'A feature you wish existed' },
    { key: 'general', label: 'General', icon: 'message-circle', description: 'Anything else on your mind' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onClose }) => {
    const [category, setCategory] = useState<FeedbackCategory>('general');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const canSubmit = message.trim().length >= 3 && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            await feedbackService.submit({
                message: message.trim(),
                category,
                email: email.trim() || undefined,
            });
            setDone(true);
            setTimeout(() => {
                setDone(false);
                setMessage('');
                setEmail('');
                setCategory('general');
                onClose();
            }, 1400);
        } catch (e: any) {
            Alert.alert('Could not send', e?.message || 'Try again in a moment.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDismiss = () => {
        if (submitting) return;
        setMessage('');
        setEmail('');
        setCategory('general');
        setDone(false);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleDismiss}>
            <SafeAreaView style={[st.safe, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <View style={st.header}>
                        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                            <Feather name="x" size={24} color={Acid.tx3} />
                        </TouchableOpacity>
                        <Text style={[st.title, { color: Acid.tx }]}>Send feedback</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    {done ? (
                        <View style={st.successWrap}>
                            <View style={[st.successIcon, { backgroundColor: Acid.good + '15' }]}>
                                <Feather name="check" size={40} color={Acid.good} />
                            </View>
                            <Text style={[st.successTitle, { color: Acid.tx }]}>Got it</Text>
                            <Text style={[st.successSub, { color: Acid.tx2 }]}>Thanks. We read every one.</Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={st.content}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={[st.lede, { color: Acid.tx2 }]}>
                                Tell us what's working, what isn't, or what you'd love to see.
                            </Text>

                            {/* Category picker */}
                            <Text style={[st.label, { color: Acid.tx }]}>What's this about?</Text>
                            <View style={st.categoryRow}>
                                {CATEGORIES.map((c) => {
                                    const active = category === c.key;
                                    return (
                                        <TouchableOpacity
                                            key={c.key}
                                            onPress={() => setCategory(c.key)}
                                            activeOpacity={0.85}
                                            style={[
                                                st.categoryCard,
                                                {
                                                    backgroundColor: active ? Acid.lime : Acid.mossDeep,
                                                    borderColor: active ? Acid.lime : Acid.hair,
                                                },
                                            ]}
                                        >
                                            <Feather
                                                name={c.icon}
                                                size={18}
                                                color={active ? Acid.moss : Acid.tx}
                                            />
                                            <Text
                                                style={[
                                                    st.categoryLabel,
                                                    { color: active ? Acid.moss : Acid.tx },
                                                ]}
                                            >
                                                {c.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <Text style={[st.categoryHint, { color: Acid.tx3 }]}>
                                {CATEGORIES.find((c) => c.key === category)?.description}
                            </Text>

                            {/* Message */}
                            <Text style={[st.label, { color: Acid.tx, marginTop: 24 }]}>Your message</Text>
                            <View style={[st.textareaWrap, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
                                <TextInput
                                    multiline
                                    value={message}
                                    onChangeText={setMessage}
                                    placeholder="The more specific, the better."
                                    placeholderTextColor={Acid.tx3}
                                    style={[st.textarea, { color: Acid.tx }]}
                                    maxLength={4000}
                                    textAlignVertical="top"
                                />
                            </View>
                            <Text style={[st.counter, { color: Acid.tx3 }]}>{message.length}/4000</Text>

                            {/* Email (optional) */}
                            <Text style={[st.label, { color: Acid.tx, marginTop: 20 }]}>
                                Email <Text style={{ color: Acid.tx3, fontWeight: '500' }}>(optional, if you want a reply)</Text>
                            </Text>
                            <View style={[st.inputWrap, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="you@example.com"
                                    placeholderTextColor={Acid.tx3}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={[st.input, { color: Acid.tx }]}
                                />
                            </View>

                            <View style={{ height: 32 }} />
                        </ScrollView>
                    )}

                    {!done && (
                        <View style={[st.footer, { borderTopColor: Acid.hair, backgroundColor: Acid.moss }]}>
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={!canSubmit}
                                style={[
                                    st.submitBtn,
                                    {
                                        backgroundColor: canSubmit ? Acid.lime : Acid.mossDeep,
                                        opacity: canSubmit ? 1 : 0.6,
                                    },
                                ]}
                                activeOpacity={0.85}
                            >
                                {submitting ? (
                                    <ActivityIndicator color={Acid.moss} />
                                ) : (
                                    <Text style={[st.submitTxt, { color: canSubmit ? Acid.moss : Acid.tx3 }]}>
                                        Send feedback
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

const st = StyleSheet.create({
    safe: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    title: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 8,
    },
    lede: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 10,
    },
    categoryRow: {
        flexDirection: 'row',
        gap: 8,
    },
    categoryCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    categoryLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    categoryHint: {
        fontSize: 13,
        marginTop: 10,
        lineHeight: 18,
    },
    textareaWrap: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 160,
    },
    textarea: {
        fontSize: 15,
        lineHeight: 22,
        minHeight: 140,
    },
    counter: {
        fontSize: 11,
        textAlign: 'right',
        marginTop: 6,
    },
    inputWrap: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: Platform.OS === 'ios' ? 12 : 6,
    },
    input: {
        fontSize: 15,
    },
    footer: {
        borderTopWidth: 1,
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 18,
    },
    submitBtn: {
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitTxt: {
        fontSize: 16,
        fontWeight: '700',
    },
    successWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 6,
    },
    successSub: {
        fontSize: 15,
        textAlign: 'center',
    },
});
