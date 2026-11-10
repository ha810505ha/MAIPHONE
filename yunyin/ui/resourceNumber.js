export function formatResourceNumber(value, locale, compact = false) {
  const number = Number(value);
  const amount = Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
  if (!compact || amount < 10000) return amount.toLocaleString(locale);
  const formatted = new Intl.NumberFormat(locale, {
    notation: "compact", maximumSignificantDigits: 3,
  }).format(amount);
  // Keep even balances beyond the locale's largest named unit within the HUD.
  return formatted.length <= 8 ? formatted : new Intl.NumberFormat(locale, {
    notation: "scientific", maximumSignificantDigits: 3,
  }).format(amount);
}
