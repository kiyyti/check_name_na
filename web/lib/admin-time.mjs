// Legacy Sessions rows do not have per-session cutoff columns yet.
// Return an empty value so callers can fall back to the Settings cutoffs.
export function clock(value) {
  return typeof value === 'string' ? value.match(/\d{2}:\d{2}/)?.[0] || '' : '';
}
