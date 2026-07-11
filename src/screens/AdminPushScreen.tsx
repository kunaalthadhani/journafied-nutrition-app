import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { notificationService } from '../services/notificationService';
import { PushBroadcastRecord } from '../services/dataStorage';

interface AdminPushScreenProps {
  onBack: () => void;
}

interface BroadcastSummary {
  successCount: number;
  failureCount: number;
  targetCount: number;
}

/**
 * Hidden admin screen that lets the team broadcast manual push notifications.
 * Triggered by tapping the menu title five times.
 */
export const AdminPushScreen: React.FC<AdminPushScreenProps> = ({ onBack }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [storedTokens, setStoredTokens] = useState<string[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [history, setHistory] = useState<PushBroadcastRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [broadcastSummary, setBroadcastSummary] = useState<BroadcastSummary | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const loadTokens = async () => {
    setIsLoadingTokens(true);
    const tokens = await notificationService.getStoredPushTokens();
    setStoredTokens(tokens);
    setIsLoadingTokens(false);
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    const records = await notificationService.getBroadcastHistory();
    setHistory(records);
    setIsLoadingHistory(false);
  };

  useEffect(() => {
    loadTokens();
    loadHistory();
  }, []);

  const handleSendPush = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing fields', 'Please provide both a title and message.');
      return;
    }

    setIsSending(true);
    setBroadcastSummary(null);
    setLastError(null);

    try {
      const result = await notificationService.sendBroadcastPush(title.trim(), message.trim());
      if (result.targetCount > 0) {
        setBroadcastSummary({
          successCount: result.successCount,
          failureCount: result.failureCount,
          targetCount: result.targetCount,
        });
      }

      if (result.failureCount > 0) {
        setLastError(
          `Failed to deliver to ${result.failureCount} device(s). See console for token-specific errors.`
        );
      } else {
        setLastError(null);
      }
      await loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLastError(message);
      Alert.alert('Push Error', message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: Acid.hair }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={Acid.tx} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Acid.tx }]}>
            Admin Push Console
          </Text>
          <TouchableOpacity
            onPress={() => {
              loadTokens();
              loadHistory();
            }}
            style={styles.refreshButton}
          >
            {isLoadingTokens || isLoadingHistory ? (
              <ActivityIndicator size="small" color={Acid.lime} />
            ) : (
              <Feather name="refresh-cw" size={20} color={Acid.tx} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: Acid.mossDeep,
                borderColor: Acid.hair,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: Acid.tx2 }]}>
              Manual Push Broadcast
            </Text>
            <Text style={[styles.helperText, { color: Acid.tx2 }]}>
              Craft a title and message, then deliver it to every device that has granted push
              permissions.
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: Acid.tx }]}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Subscription reminder"
                placeholderTextColor={Acid.tx3}
                style={[
                  styles.input,
                  {
                    backgroundColor: Acid.mossDeep,
                    color: Acid.tx,
                    borderColor: Acid.hair,
                  },
                ]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: Acid.tx }]}>Message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="We added new premium recipes. Tap to explore!"
                placeholderTextColor={Acid.tx3}
                multiline
                numberOfLines={4}
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: Acid.mossDeep,
                    color: Acid.tx,
                    borderColor: Acid.hair,
                  },
                ]}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: Acid.lime, opacity: isSending ? 0.7 : 1 },
              ]}
              onPress={handleSendPush}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color={Acid.moss} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: Acid.moss }]}>Send Push</Text>
              )}
            </TouchableOpacity>

            {broadcastSummary && (
              <View style={[styles.summaryContainer, { borderColor: Acid.hair }]}>
                <Feather
                  name={broadcastSummary.failureCount > 0 ? 'alert-triangle' : 'check-circle'}
                  size={18}
                  color={broadcastSummary.failureCount > 0 ? Acid.error : Acid.good}
                />
                <Text style={[styles.summaryText, { color: Acid.tx2 }]}>
                  Targeted {broadcastSummary.targetCount} device(s) · Delivered to{' '}
                  {broadcastSummary.successCount} device(s).{' '}
                  {broadcastSummary.failureCount > 0
                    ? `${broadcastSummary.failureCount} failure(s).`
                    : 'No delivery errors recorded.'}
                </Text>
              </View>
            )}

            {lastError && (
              <Text style={[styles.errorText, { color: Acid.error }]}>{lastError}</Text>
            )}
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: Acid.mossDeep,
                borderColor: Acid.hair,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: Acid.tx2 }]}>
              Registered Devices
            </Text>
            {isLoadingTokens ? (
              <ActivityIndicator style={{ marginTop: 12 }} color={Acid.lime} />
            ) : storedTokens.length === 0 ? (
              <Text style={[styles.helperText, { color: Acid.tx2 }]}>
                No tokens saved yet. Launch the app on a physical device and accept push
                permissions to register.
              </Text>
            ) : (
              storedTokens.map((token) => (
                <View key={token} style={[styles.tokenRow, { borderColor: Acid.hair }]}>
                  <Text style={[styles.tokenText, { color: Acid.tx2 }]}>
                    {token}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: Acid.mossDeep,
                borderColor: Acid.hair,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: Acid.tx2 }]}>
              Delivery History
            </Text>
            {isLoadingHistory ? (
              <ActivityIndicator style={{ marginTop: 12 }} color={Acid.lime} />
            ) : history.length === 0 ? (
              <Text style={[styles.helperText, { color: Acid.tx2 }]}>
                No broadcasts sent yet. When you send push notifications, delivery stats will appear
                here.
              </Text>
            ) : (
              history.map((record) => (
                <View key={record.id} style={[styles.historyCard, { borderColor: Acid.hair }]}>
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyTitle, { color: Acid.tx }]}>
                      {record.title || 'Untitled broadcast'}
                    </Text>
                    <Text style={[styles.historyTimestamp, { color: Acid.tx3 }]}>
                      {format(new Date(record.timestamp), 'MMM d, yyyy · h:mm a')}
                    </Text>
                  </View>
                  <Text style={[styles.historyMessage, { color: Acid.tx2 }]}>
                    {record.message}
                  </Text>
                  <View style={styles.historyStatsRow}>
                    <View style={styles.historyStat}>
                      <Feather name="users" size={15} color={Acid.tx} />
                      <Text style={[styles.historyStatText, { color: Acid.tx2 }]}>
                        Targets {record.targetCount}
                      </Text>
                    </View>
                    <View style={styles.historyStat}>
                      <Feather name="check-circle" size={15} color={Acid.good} />
                      <Text style={[styles.historyStatText, { color: Acid.tx2 }]}>
                        Sent {record.successCount}
                      </Text>
                    </View>
                    <View style={styles.historyStat}>
                      <Feather name="alert-triangle" size={15} color={Acid.error} />
                      <Text style={[styles.historyStatText, { color: Acid.tx2 }]}>
                        Failed {record.failureCount}
                      </Text>
                    </View>
                    <View style={styles.historyStat}>
                      <Feather name="mouse-pointer" size={15} color={Acid.protein} />
                      <Text style={[styles.historyStatText, { color: Acid.tx2 }]}>
                        Clicks {record.clickCount}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: Acid.mossDeep,
                borderColor: Acid.hair,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: Acid.tx2 }]}>
              How to Test
            </Text>
            <View style={styles.listItem}>
              <Feather name="check" size={16} color={Acid.tx} />
              <Text style={[styles.listText, { color: Acid.tx2 }]}>
                Install the app on a physical device (push notifications do not work on most
                simulators).
              </Text>
            </View>
            <View style={styles.listItem}>
              <Feather name="check" size={16} color={Acid.tx} />
              <Text style={[styles.listText, { color: Acid.tx2 }]}>
                On first launch, accept the push notification permission prompt.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Feather name="check" size={16} color={Acid.tx} />
              <Text style={[styles.listText, { color: Acid.tx2 }]}>
                Open the sidebar and tap the “Menu” title five times to reveal this console.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Feather name="check" size={16} color={Acid.tx} />
              <Text style={[styles.listText, { color: Acid.tx2 }]}>
                Enter a title/message, press “Send Push”, and observe the delivery log in the device
                notification center and Metro logs.
              </Text>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  helperText: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  formGroup: {
    marginTop: 16,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.fontSize.md,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 20,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'transparent',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  summaryContainer: {
    marginTop: 18,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  errorText: {
    marginTop: 12,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  tokenRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  tokenText: {
    fontSize: Typography.fontSize.xs,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  historyTitle: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  historyTimestamp: {
    fontSize: Typography.fontSize.xs,
  },
  historyMessage: {
    marginTop: 8,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  historyStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  historyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyStatText: {
    fontSize: Typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  listText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
});


