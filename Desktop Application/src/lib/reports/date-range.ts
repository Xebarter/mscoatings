export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'quarter'
  | 'year'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
  preset: DatePreset;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string
): DateRange {
  const now = new Date();

  if (preset === 'custom' && customFrom && customTo) {
    return {
      preset,
      start: startOfDay(new Date(customFrom)),
      end: endOfDay(new Date(customTo)),
    };
  }

  switch (preset) {
    case 'yesterday': {
      const day = new Date(now);
      day.setDate(day.getDate() - 1);
      return { preset, start: startOfDay(day), end: endOfDay(day) };
    }
    case 'last7': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { preset, start: startOfDay(start), end: endOfDay(now) };
    }
    case 'last30': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { preset, start: startOfDay(start), end: endOfDay(now) };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { preset, start: startOfDay(start), end: endOfDay(now) };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { preset, start: startOfDay(start), end: endOfDay(end) };
    }
    case 'quarter': {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterMonth, 1);
      return { preset, start: startOfDay(start), end: endOfDay(now) };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { preset, start: startOfDay(start), end: endOfDay(now) };
    }
    case 'today':
    default:
      return { preset: 'today', start: startOfDay(now), end: endOfDay(now) };
  }
}

export function getComparisonRange(range: DateRange): DateRange {
  const durationMs = range.end.getTime() - range.start.getTime();
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - durationMs);
  return { preset: range.preset, start, end };
}

export function getYearOverYearRange(range: DateRange): DateRange {
  const start = new Date(range.start);
  const end = new Date(range.end);
  start.setFullYear(start.getFullYear() - 1);
  end.setFullYear(end.getFullYear() - 1);
  return { preset: range.preset, start, end };
}

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 Days',
  last30: 'Last 30 Days',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  quarter: 'This Quarter',
  year: 'This Year',
  custom: 'Custom Range',
};
