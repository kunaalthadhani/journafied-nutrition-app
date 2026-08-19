/**
 * The family trial.
 *
 * Three weeks, everything on, in every Track app at once. It starts when the
 * person creates their Track account, not when they install a particular app,
 * so installing the second app does not hand out a second free run. That is
 * the whole point: one trial per person, both halves unlocked, and the way to
 * get value out of it is to try both.
 *
 * The clock is `profiles.created_at`. That row is created by a server trigger
 * on signup, so it exists for everyone, it cannot be written by a client, and
 * reinstalling does not reset it. No column of our own to keep in step.
 */

export const TRIAL_DAYS = 21;

const DAY_MS = 86400000;

export interface TrialState {
  /** Premium is on because of the trial right now. */
  active: boolean;
  /** Whole days remaining, 0 once it is over. Rounded up, so the last day reads 1. */
  daysLeft: number;
  /** ISO, or null when we do not know when the account was made. */
  endsAt: string | null;
  /** They had a trial and it has run out. Distinct from never having had one. */
  expired: boolean;
}

export const NO_TRIAL: TrialState = { active: false, daysLeft: 0, endsAt: null, expired: false };

export const trialFrom = (startedAt?: string | null, now: Date = new Date()): TrialState => {
  if (!startedAt) return NO_TRIAL;

  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return NO_TRIAL;

  const end = start + TRIAL_DAYS * DAY_MS;
  const remaining = end - now.getTime();

  if (remaining <= 0) {
    return { active: false, daysLeft: 0, endsAt: new Date(end).toISOString(), expired: true };
  }

  return {
    active: true,
    daysLeft: Math.ceil(remaining / DAY_MS),
    endsAt: new Date(end).toISOString(),
    expired: false,
  };
};

/** "6 days left" / "Last day" / "Ends today". Never "0 days left". */
export const trialLabel = (t: TrialState): string => {
  if (!t.active) return '';
  if (t.daysLeft <= 1) return 'Last day';
  return `${t.daysLeft} days left`;
};
