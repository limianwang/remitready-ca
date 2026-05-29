import rates from './ca-bc-2026.json' with { type: 'json' };
import { assertValidRatesPayload, resolvePayrollPeriodRates } from './validateRates.js';

export const BC_2026_RATES = assertValidRatesPayload(rates);
export const BC_2026_ANNUAL_TAX_RATES = BC_2026_RATES.annualTax;

function normalizeDate(date) {
  return String(date || '').slice(0, 10);
}

export function getBc2026RatesForDate(date) {
  const paymentDate = normalizeDate(date);
  const period = BC_2026_RATES.payrollPeriods.find((period) => (
    paymentDate >= period.effectiveFrom && paymentDate <= period.effectiveTo
  )) ?? BC_2026_RATES.payrollPeriods[0];
  return resolvePayrollPeriodRates(BC_2026_RATES.annualTax, period);
}

export function getBc2026AnnualTaxRates() {
  return BC_2026_ANNUAL_TAX_RATES;
}

export function getBc2026TargetTaxRatesForDate(date) {
  const paymentDate = normalizeDate(date);
  return paymentDate >= '2026-07-01'
    ? BC_2026_ANNUAL_TAX_RATES
    : getBc2026RatesForDate(date);
}
