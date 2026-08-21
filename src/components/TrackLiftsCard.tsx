import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import { Acid } from '../constants/acid';
import { AccountInfo } from '../services/dataStorage';
import { supabaseDataService } from '../services/supabaseDataService';
import { openTrackLifts } from './TrialBanner';

/**
 * The mirror of the TrackKcal card on the TrackLifts home screen. Their side
 * shows what you ate, this side shows what you lifted.
 *
 * The burn estimate is deliberately not shown as a number you can spend. It is
 * context, never currency: FAMILY.md bans it entering the eating budget, and a
 * card that puts it next to calories left would invite exactly that.
 */

interface Week {
  sessions: number;
  volumeKg: number | null;
  trainedToday: boolean;
  lastHighlight: string | null;
}

export const TrackLiftsCard: React.FC<{ accountInfo: AccountInfo | null }> = ({ accountInfo }) => {
  const [week, setWeek] = useState<Week | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!accountInfo?.supabaseUserId) { setChecked(true); return; }
      try {
        const since = format(subDays(new Date(), 6), 'yyyy-MM-dd');
        const days = await supabaseDataService.fetchLiftsDays(accountInfo, since);
        if (!alive) return;
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        const trained = days.filter(d => d.sessions > 0);
        setWeek({
          sessions: trained.reduce((s, d) => s + d.sessions, 0),
          volumeKg: trained.reduce((s, d) => s + (d.volumeKg || 0), 0) || null,
          trainedToday: days.some(d => d.date === todayKey && d.sessions > 0),
          lastHighlight: trained[0]?.highlight ?? null,
        });
      } catch {
        // A sibling that has not shipped its writer yet is not an error
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => { alive = false; };
  }, [accountInfo?.supabaseUserId]);

  // Say nothing until we know. A card that flashes "not connected" and then
  // fills in reads as a bug.
  if (!checked) return null;

  const connected = !!week && week.sessions > 0;

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <View style={styles.dotRow}>
          <View style={styles.dot} />
          <Text style={styles.brand}>TRACK<Text style={{ color: Acid.tx }}>LIFTS</Text></Text>
        </View>
        <Text style={styles.status}>{connected ? 'CONNECTED' : 'NOT CONNECTED'}</Text>
      </View>

      {connected ? (
        <>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>THIS WEEK</Text>
            <Text style={styles.statValue}>
              {week!.sessions} session{week!.sessions === 1 ? '' : 's'}
            </Text>
          </View>
          {week!.volumeKg != null && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>VOLUME</Text>
              <Text style={styles.statValue}>{Math.round(week!.volumeKg).toLocaleString()} kg</Text>
            </View>
          )}
          <Text style={styles.body}>
            {week!.trainedToday
              ? 'You trained today. Eat like it, protein first.'
              : 'Your training sits beside your food, so the coach sees the whole picture.'}
          </Text>
          {!!week!.lastHighlight && (
            <Text style={styles.highlight}>{week!.lastHighlight}</Text>
          )}
          <TouchableOpacity onPress={openTrackLifts} style={styles.openRow} activeOpacity={0.7}>
            <Text style={styles.openTxt}>OPEN TRACKLIFTS</Text>
            <Feather name="arrow-up-right" size={14} color={Acid.tx2} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Your training, next to your food. Log a session over there and this card comes alive,
            with the coach reading both halves.
          </Text>
          <TouchableOpacity onPress={openTrackLifts} style={styles.cta} activeOpacity={0.85}>
            <Text style={styles.ctaTxt}>CONNECT TRACKLIFTS</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Acid.hair,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Acid.tx3 },
  brand: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
    color: Acid.tx2,
  },
  status: { fontSize: 10, letterSpacing: 1.2, color: Acid.tx3 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statLabel: { fontSize: 10, letterSpacing: 1.2, color: Acid.tx3 },
  statValue: { fontSize: 15, color: Acid.tx, fontWeight: '600' },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: Acid.tx2,
    marginTop: 10,
  },
  highlight: {
    fontFamily: Acid.serifItalic,
    fontSize: 14,
    lineHeight: 20,
    color: Acid.tx,
    marginTop: 10,
  },
  cta: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: Acid.lime,
  },
  ctaTxt: {
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: Acid.moss,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  openTxt: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600', color: Acid.tx2 },
});
