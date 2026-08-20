import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { dataStorage, trialStateFor } from '../services/dataStorage';
import { TrialState, NO_TRIAL, trialLabel, trialDateLabel } from '../utils/trial';

interface AccountReceiptProps {
  /** 'new' when we just made the account, 'returning' when it was already there. */
  kind: 'new' | 'returning';
  trial: TrialState;
  /** entitlements say kcal_premium or track_plus. A subscriber has no trial to talk about. */
  premium: boolean;
}

/**
 * The receipt's facts, straight off the server. loadUserPlan reads the
 * entitlements row and caches profiles.created_at onto the account, so both
 * halves land in one trip. Never waits long: a slow network gets the honest
 * line that names no date rather than a spinner.
 */
export const readReceipt = async (kind: 'new' | 'returning'): Promise<AccountReceiptProps> => {
  const blank: AccountReceiptProps = { kind, trial: NO_TRIAL, premium: false };
  const read = (async () => {
    const plan = await dataStorage.loadUserPlan();
    const info = await dataStorage.loadAccountInfo();
    return { kind, trial: trialStateFor(info), premium: plan === 'premium' };
  })();
  const timeout = new Promise<AccountReceiptProps>(resolve => setTimeout(() => resolve(blank), 5000));
  try {
    return await Promise.race([read, timeout]);
  } catch {
    return blank;
  }
};

// The line for someone whose trial clock has not reached this device yet. We do
// not know the date so we do not print one. Today plus 21 is a lie she catches
// tomorrow.
const NO_CLOCK = 'One account, both apps. TrackLifts opens with this same email and password.';

const OPENER = 'One account, both apps. This same email and password opens TrackLifts, and your profile travels with you.';

const linesFor = ({ kind, trial, premium }: AccountReceiptProps): string[] => {
  if (kind === 'new') {
    if (premium) return [OPENER, 'Everything is open in both apps.'];
    if (trial.active) {
      return [
        OPENER,
        `Everything is unlocked in both apps for three weeks, until ${trialDateLabel(trial.endsAt)}. One trial per person, not per app, so opening TrackLifts does not shorten it and does not hand you a second one.`,
      ];
    }
    return [NO_CLOCK];
  }

  if (premium) return ['Everything is open in both apps.'];
  if (trial.active) return [`Both apps stay fully open until ${trialDateLabel(trial.endsAt)}. ${trialLabel(trial)}.`];
  if (trial.expired) return [`Your free three weeks ended on ${trialDateLabel(trial.endsAt, false)}.`];
  return [NO_CLOCK];
};

/**
 * What she just got, said on the screen before she moves on. The trial dates
 * come from profiles.created_at through trialFrom, never from arithmetic done
 * here, so someone who made her account in TrackLifts 18 days ago reads 3 days
 * left and not 21.
 */
export const AccountReceipt: React.FC<AccountReceiptProps> = (props) => (
  <View style={styles.wrap}>
    <Text style={styles.title}>
      {props.kind === 'new'
        ? 'Your Track account is made.'
        : 'Welcome back. This is your Track account, the one TrackLifts already knows.'}
    </Text>
    {linesFor(props).map(line => (
      <Text key={line} style={styles.body}>{line}</Text>
    ))}
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: 12, alignSelf: 'stretch' },
  title: {
    fontFamily: Acid.serifItalic,
    fontSize: 19,
    lineHeight: 27,
    color: Acid.tx,
  },
  body: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
    color: Acid.tx2,
  },
});
