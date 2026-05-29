import test from 'node:test';
import assert from 'node:assert/strict';
import { BC_2026_RATES, getBc2026RatesForDate } from '../src/rates/ca-bc-2026.js';
import {
  getInspectableRates,
  getRatePeriodRows
} from '../src/lib/constantsView.js';

const payrollPeriodRates = BC_2026_RATES.payrollPeriods.map((period) => (
  getBc2026RatesForDate(period.effectiveFrom)
));

test('falls back to active calculation constants when no inspected period is selected', () => {
  const activeRates = payrollPeriodRates[0];

  const inspectedRates = getInspectableRates(payrollPeriodRates, activeRates, '');

  assert.equal(inspectedRates.effectivePeriod, '2026-01-01 to 2026-06-30');
});

test('selects inspected constants independently from active calculation constants', () => {
  const activeRates = payrollPeriodRates[0];

  const inspectedRates = getInspectableRates(
    payrollPeriodRates,
    activeRates,
    '2026-07-01 to 2026-12-31'
  );

  assert.equal(inspectedRates.effectivePeriod, '2026-07-01 to 2026-12-31');
  assert.equal(inspectedRates.bc.taxReductionMax, 805);
});

test('marks active and inspected rate periods separately', () => {
  const rows = getRatePeriodRows({
    periods: payrollPeriodRates,
    activeEffectivePeriod: '2026-01-01 to 2026-06-30',
    inspectedEffectivePeriod: '2026-07-01 to 2026-12-31'
  });

  assert.deepEqual(rows.map((row) => ({
    effectivePeriod: row.effectivePeriod,
    active: row.active,
    inspected: row.inspected
  })), [
    { effectivePeriod: '2026-01-01 to 2026-06-30', active: true, inspected: false },
    { effectivePeriod: '2026-07-01 to 2026-12-31', active: false, inspected: true }
  ]);
});
