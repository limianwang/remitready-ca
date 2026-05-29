export function roundToCents(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function dollarsToCents(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round((parsed + Number.EPSILON) * 100);
}

export function centsToDollars(cents) {
  return roundToCents(cents / 100);
}

export function parseMoney(value) {
  return centsToDollars(dollarsToCents(value));
}

export function ceilToIncrement(value, incrementDollars) {
  if (incrementDollars <= 0) return roundToCents(value);
  return roundToCents(Math.ceil(value / incrementDollars) * incrementDollars);
}

export function formatMoney(value) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(roundToCents(value));
}
