import { startOfDay, endOfDay, subDays, subMonths, subYears, format, differenceInCalendarDays } from 'date-fns';

// One definition of what a chart range pill means, shared by every chart in the
// app. Before this, the same "1W" pill meant 7 days on the calorie chart, 8 days
// on the weight chart, and a rolling 24h-multiple in two insight cards.
export type ChartRange = '1W' | '1M' | '3M' | '6M' | '1Y';

export const CHART_RANGES: ChartRange[] = ['1W', '1M', '3M', '6M', '1Y'];

export interface RangeWindow {
  start: Date; // inclusive, local start of day
  end: Date;   // inclusive, local end of today — future-dated entries never show
}

export function getRangeWindow(range: ChartRange, now: Date = new Date()): RangeWindow {
  const end = endOfDay(now);
  switch (range) {
    case '1W': return { start: startOfDay(subDays(now, 6)), end };
    case '1M': return { start: startOfDay(subMonths(now, 1)), end };
    case '3M': return { start: startOfDay(subMonths(now, 3)), end };
    case '6M': return { start: startOfDay(subMonths(now, 6)), end };
    case '1Y': return { start: startOfDay(subYears(now, 1)), end };
  }
}

export function isInRange(date: Date, window: RangeWindow): boolean {
  return date >= window.start && date <= window.end;
}

// The window immediately before the current one, same length in calendar days.
// Used for honest "vs previous period" comparisons instead of a hardcoded
// last-7-days chip. Calendar math, not millisecond math, so a DST transition
// inside the window cannot shift the boundary off local midnight.
export function getPreviousWindow(range: ChartRange, now: Date = new Date()): RangeWindow {
  const current = getRangeWindow(range, now);
  const days = differenceInCalendarDays(current.end, current.start) + 1;
  return {
    start: startOfDay(subDays(current.start, days)),
    end: endOfDay(subDays(current.start, 1)),
  };
}

// Human words for the window, for context lines under heroes and charts.
export function rangeLabel(range: ChartRange): string {
  switch (range) {
    case '1W': return 'last 7 days';
    case '1M': return 'last month';
    case '3M': return 'last 3 months';
    case '6M': return 'last 6 months';
    case '1Y': return 'last year';
  }
}

export function previousRangeLabel(range: ChartRange): string {
  switch (range) {
    case '1W': return 'previous 7 days';
    case '1M': return 'previous month';
    case '3M': return 'previous 3 months';
    case '6M': return 'previous 6 months';
    case '1Y': return 'previous year';
  }
}

export function formatWindowDates(window: RangeWindow): string {
  return `${format(window.start, 'd MMM')} – ${format(window.end, 'd MMM yyyy')}`;
}

// Least-squares slope over dated points, in units per week. Endpoint-pair math
// let one noisy weigh-in swing the whole "weekly rate"; a fit does not.
export function weeklyTrendSlope(points: { date: Date; value: number }[]): number | null {
  if (points.length < 2) return null;
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const xs = points.map((p) => p.date.getTime() / MS_PER_WEEK);
  const ys = points.map((p) => p.value);
  const n = points.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  if (den === 0) return null;
  return num / den;
}
