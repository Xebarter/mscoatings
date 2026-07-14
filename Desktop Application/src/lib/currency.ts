export function formatUgx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString('en-UG')}`;
}

export function formatDate(
  ts: { toDate?: () => Date; seconds?: number } | undefined
): string {
  let date: Date;
  if (ts && typeof ts.toDate === 'function') date = ts.toDate();
  else if (ts && typeof ts.seconds === 'number') date = new Date(ts.seconds * 1000);
  else return '—';
  if (date.getTime() === 0) return '—';
  return date.toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
