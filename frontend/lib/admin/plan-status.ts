/** Plan expiry state for admin views. plan_expire is stored as epoch milliseconds. */
export function getPlanExpiry(planExpire?: string | number | null): {
  label: string;
  expired: boolean;
  hasExpiry: boolean;
} {
  const ms = Number(planExpire);
  if (!planExpire || !Number.isFinite(ms) || ms <= 0) {
    return { label: 'No expiry', expired: false, hasExpiry: false };
  }
  const date = new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const expired = ms <= Date.now();
  return { label: expired ? `Expired ${date}` : `Until ${date}`, expired, hasExpiry: true };
}
