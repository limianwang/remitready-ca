import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpeningBalanceRecord,
  createPaymentRecord,
  deriveYtdFromHistory,
  validateHistoryPayload,
  validateYearEndPosition
} from '../src/lib/history.js';
import { exportHistoryJson, getHistoryExportFilename, importHistoryJson } from '../src/lib/jsonHistory.js';

test('creates stable payment records from calculation results', () => {
  const record = createPaymentRecord({
    id: 'pay_1',
    paidOn: '2026-05-26',
    taxYear: 2026,
    note: 'owner payroll',
    result: {
      currentGross: 10000,
      cpp: { employeeCpp: 595, employeeCpp2: 0, totalEmployerCpp: 595 },
      tax: { federalTax: 1500, bcTax: 500, totalIncomeTax: 2000 },
      netPay: 7405,
      employerRemittance: 3190
    }
  });

  assert.equal(record.taxYear, 2026);
  assert.equal(record.grossPay, 10000);
  assert.equal(record.employeeCpp, 595);
  assert.equal(record.incomeTaxWithheld, 2000);
});

test('creates opening balance records for prior payroll context', () => {
  const record = createOpeningBalanceRecord({
    id: 'opening_1',
    paidOn: '2026-05-27',
    taxYear: 2026,
    grossPay: 80000,
    pensionableEarnings: 75000,
    employeeCpp: 4230.45,
    employeeCpp2: 0,
    incomeTaxWithheld: 13385.52
  });

  assert.equal(record.kind, 'opening-balance');
  assert.equal(record.grossPay, 80000);
  assert.equal(record.pensionableEarnings, 75000);
  assert.equal(record.employerCpp, 4230.45);
  assert.equal(record.employerRemittance, 21846.42);
});

test('derives YTD values from imported and new history', () => {
  const ytd = deriveYtdFromHistory([
    { taxYear: 2026, grossPay: 10000, pensionableEarnings: 8000, employeeCpp: 595, employeeCpp2: 0, incomeTaxWithheld: 2000 },
    { taxYear: 2026, grossPay: 5000, employeeCpp: 297.5, employeeCpp2: 0, incomeTaxWithheld: 900 },
    { taxYear: 2025, grossPay: 9999, employeeCpp: 1, employeeCpp2: 0, incomeTaxWithheld: 1 }
  ], 2026);

  assert.deepEqual(ytd, {
    ytdPriorLumpSums: 15000,
    ytdPensionableEarnings: 13000,
    ytdEmployeeCpp: 892.5,
    ytdEmployeeCpp2: 0,
    ytdIncomeTaxWithheld: 2900
  });
});

test('rejects invalid imported history payloads', () => {
  const result = validateHistoryPayload({ version: 1, records: [{ grossPay: -1 }] });
  assert.equal(result.valid, false);
});

test('imports and exports valid history JSON', () => {
  const json = exportHistoryJson([{
    kind: 'opening-balance',
    taxYear: 2026,
    grossPay: 10000,
    pensionableEarnings: 9000,
    employeeCpp: 595,
    incomeTaxWithheld: 2000
  }], '2026-05-26T12:30:00.000Z');
  const records = importHistoryJson(json);
  assert.equal(records.length, 1);
  assert.equal(records[0].grossPay, 10000);
  assert.equal(records[0].pensionableEarnings, 9000);
});

test('generates timestamped export filename', () => {
  assert.equal(getHistoryExportFilename(2026, '2026-05-26T12:30:00.000Z'), 'remitready-ca-history-2026-2026-05-26.json');
});

test('year-end validator reports projected refund when over-withheld', () => {
  const result = validateYearEndPosition({
    records: [
      { taxYear: 2026, grossPay: 70000, employeeCpp: 3956.75, employeeCpp2: 0, incomeTaxWithheld: 20000 }
    ],
    taxYear: 2026,
    estimatedAnnualIncomeTax: 15000
  });

  assert.equal(result.totalGrossPay, 70000);
  assert.equal(result.projectedBalance, -5000);
  assert.equal(result.status, 'over-withheld');
});
