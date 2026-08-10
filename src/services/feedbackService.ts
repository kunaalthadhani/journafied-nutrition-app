import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabaseClient';
import { dataStorage } from './dataStorage';

export type FeedbackCategory = 'bug' | 'idea' | 'general';

export interface FeedbackSubmission {
    message: string;
    category: FeedbackCategory;
    email?: string;
    screen?: string;
}

function detectSource(): string {
    if (Platform.OS === 'web') return 'pwa';
    if (Platform.OS === 'ios') return 'ios';
    if (Platform.OS === 'android') return 'android';
    return Platform.OS;
}

function detectUserAgent(): string | undefined {
    try {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
            return navigator.userAgent.slice(0, 500);
        }
    } catch { /* noop */ }
    return undefined;
}

export const feedbackService = {
    async submit(input: FeedbackSubmission): Promise<void> {
        const message = input.message.trim();
        if (message.length < 3) throw new Error('Say a little more, three characters at least.');
        if (message.length > 2000) throw new Error('Message is too long.');

        const accountInfo = await dataStorage.loadAccountInfo();
        const email = input.email?.trim() || accountInfo?.email || null;
        const appVersion = (Constants as any)?.expoConfig?.version || (Constants as any)?.manifest?.version || null;

        if (!supabase) throw new Error('Backend unavailable. Try again later.');

        // the family feedback table: app tagged, body is the message, email
        // stays the practical contact key
        const { error } = await supabase.from('feedback').insert({
            app: 'kcal',
            user_id: accountInfo?.supabaseUserId || null,
            email,
            body: message,
            category: input.category,
            source: detectSource(),
            screen: input.screen || null,
            app_version: appVersion,
            user_agent: detectUserAgent(),
        });

        if (error) {
            console.error('Feedback submit failed', error);
            throw new Error(error.message || 'Could not send feedback. Try again.');
        }
    },
};
