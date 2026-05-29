import test from 'node:test';
import assert from 'node:assert/strict';
import { annualIncomeTax } from '../src/lib/tax.js';
import {
  BC_2026_RATES,
  getBc2026AnnualTaxRates,
  getBc2026RatesForDate,
  getBc2026TargetTaxRatesForDate
} from '../src/rates/ca-bc-2026.js';
import { validateRatesPayload } from '../src/rates/validateRates.js';

test('validates the BC 2026 rate file schema', () => {
  const validation = validateRatesPayload(BC_2026_RATES);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test('selects January 2026 constants before July payroll update', () => {
  const rates = getBc2026RatesForDate('2026-06-30');
  const annualRates = getBc2026AnnualTaxRates();

  assert.equal(rates.effectivePeriod, '2026-01-01 to 2026-06-30');
  assert.equal(rates.bc.lowestRate, 0.0506);
  assert.equal(rates.bc.taxReductionMax, 575);
  assert.equal(rates.federal.lowestRate, annualRates.federal.lowestRate);
  assert.equal(rates.cpp.ympe, annualRates.cpp.ympe);
});

test('selects July 2026 constants from July 1 onward', () => {
  const rates = getBc2026RatesForDate('2026-07-01');

  assert.equal(rates.effectivePeriod, '2026-07-01 to 2026-12-31');
  assert.equal(rates.bc.lowestRate, 0.0614);
  assert.equal(rates.bc.taxReductionMax, 805);
});

test('keeps annual validator rates separate from payroll withholding periods', () => {
  const annualRates = getBc2026AnnualTaxRates();
  const januaryRates = getBc2026RatesForDate('2026-01-15');
  const julyRates = getBc2026RatesForDate('2026-07-01');

  assert.equal(annualRates.effectivePeriod, '2026 annual final tax basis');
  assert.equal(annualRates.bc.lowestRate, 0.056);
  assert.equal(annualRates.bc.taxReductionMax, 690);
  assert.deepEqual(
    annualRates.bc.brackets.map((bracket) => bracket.constant),
    [0, 1058, 3878, 5948, 9332, 13331, 23156]
  );
  assert.equal(januaryRates.bc.lowestRate, 0.0506);
  assert.equal(julyRates.bc.lowestRate, 0.0614);
});

test('selects target-zero basis by payment date', () => {
  assert.equal(getBc2026TargetTaxRatesForDate('2026-06-30').bc.lowestRate, 0.0506);
  assert.equal(getBc2026TargetTaxRatesForDate('2026-07-01').bc.lowestRate, 0.056);
});

test('shows the 2026 BC catch-up gap between January payroll, annual tax, and July payroll', () => {
  const januaryTax = annualIncomeTax(120000, getBc2026RatesForDate('2026-01-15'));
  const annualTax = annualIncomeTax(120000, getBc2026AnnualTaxRates());
  const julyTax = annualIncomeTax(120000, getBc2026RatesForDate('2026-07-01'));

  assert.equal(januaryTax.totalIncomeTax, 25202.52);
  assert.equal(annualTax.totalIncomeTax, 25384.14);
  assert.equal(julyTax.totalIncomeTax, 25565.77);
  assert.equal(Number((annualTax.totalIncomeTax - januaryTax.totalIncomeTax).toFixed(2)), 181.62);
});

test('rejects malformed rate payloads', () => {
  const brokenRates = structuredClone(BC_2026_RATES);
  delete brokenRates.annualTax.bc.taxReductionMax;
  brokenRates.payrollPeriods[1].effectiveFrom = '2026-06-01';

  const validation = validateRatesPayload(brokenRates);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('rates.annualTax.bc.taxReductionMax')));
  assert.ok(validation.errors.some((error) => error.includes('rates.payrollPeriods[1].effectiveFrom')));
});

test('rejects malformed payroll period overrides after inheritance is resolved', () => {
  const brokenRates = structuredClone(BC_2026_RATES);
  brokenRates.payrollPeriods[0].overrides.bc.brackets = [
    { upTo: 50363, rate: 1.5, constant: 0 }
  ];

  const validation = validateRatesPayload(brokenRates);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => (
    error.includes('rates.payrollPeriods[0].resolved.bc.brackets[0].rate')
  )));
});

test('rejects unsupported payroll override sections', () => {
  const brokenRates = structuredClone(BC_2026_RATES);
  brokenRates.payrollPeriods[0].overrides.provincial = {};

  const validation = validateRatesPayload(brokenRates);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => (
    error.includes('rates.payrollPeriods[0].overrides.provincial')
  )));
});
