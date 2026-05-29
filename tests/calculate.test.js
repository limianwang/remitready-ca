import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayroll } from '../src/lib/calculate.js';
import { getBc2026RatesForDate, getBc2026TargetTaxRatesForDate } from '../src/rates/ca-bc-2026.js';

const baseInput = {
  ytdRegularPay: 60000,
  ytdPriorLumpSums: 0,
  ytdPensionableEarnings: 60000,
  ytdEmployeeCpp: 3361.75,
  ytdEmployeeCpp2: 0,
  ytdIncomeTaxWithheld: 11000,
  currentGross: 10000,
  taxMode: 'cra-marginal',
  conservativeMode: false,
  conservativeIncrement: 100
};

function calculateForDate(date, input) {
  return calculatePayroll(input, getBc2026RatesForDate(date), getBc2026TargetTaxRatesForDate(date));
}

test('calculates lump-sum payroll deductions with conservative mode off', () => {
  const result = calculatePayroll(baseInput);

  assert.equal(result.valid, true);
  assert.equal(result.cpp.totalEmployeeCpp, 595);
  assert.equal(result.cpp.totalEmployerCpp, 595);
  assert.ok(result.tax.totalIncomeTax > 0);
  assert.equal(result.netPay, result.currentGross - result.cpp.totalEmployeeCpp - result.tax.totalIncomeTax);
});

test('conservative mode rounds income tax up without changing CPP', () => {
  const base = calculatePayroll(baseInput);
  const conservative = calculatePayroll({ ...baseInput, conservativeMode: true });

  assert.equal(conservative.cpp.totalEmployeeCpp, base.cpp.totalEmployeeCpp);
  assert.ok(conservative.tax.totalIncomeTax >= base.tax.totalIncomeTax);
  assert.equal(conservative.tax.totalIncomeTax % 100, 0);
});

test('target-zero mode before July targets January payroll basis, not final annual tax', () => {
  const first = calculateForDate('2026-04-27', {
    ytdRegularPay: 0,
    ytdPriorLumpSums: 0,
    ytdPensionableEarnings: 0,
    ytdEmployeeCpp: 0,
    ytdEmployeeCpp2: 0,
    ytdIncomeTaxWithheld: 0,
    currentGross: 80000,
    taxMode: 'cra-marginal',
    conservativeMode: false,
    conservativeIncrement: 100
  });
  const second = calculateForDate('2026-05-27', {
    ytdRegularPay: 0,
    ytdPriorLumpSums: first.updatedYtd.lumpSums,
    ytdPensionableEarnings: first.updatedYtd.pensionableEarnings,
    ytdEmployeeCpp: first.updatedYtd.employeeCpp,
    ytdEmployeeCpp2: first.updatedYtd.employeeCpp2,
    ytdIncomeTaxWithheld: first.updatedYtd.incomeTaxWithheld,
    currentGross: 40000,
    taxMode: 'cra-marginal',
    conservativeMode: false,
    conservativeIncrement: 100
  });
  const third = calculateForDate('2026-05-28', {
    ytdRegularPay: 0,
    ytdPriorLumpSums: second.updatedYtd.lumpSums,
    ytdPensionableEarnings: second.updatedYtd.pensionableEarnings,
    ytdEmployeeCpp: second.updatedYtd.employeeCpp,
    ytdEmployeeCpp2: second.updatedYtd.employeeCpp2,
    ytdIncomeTaxWithheld: second.updatedYtd.incomeTaxWithheld,
    currentGross: 10000,
    taxMode: 'target-zero',
    conservativeMode: false,
    conservativeIncrement: 100
  });

  assert.equal(third.valid, true);
  assert.equal(third.tax.totalIncomeTax, 3829);
  assert.equal(third.updatedYtd.incomeTaxWithheld, 29031.52);
  assert.equal(third.tax.targetAnnualIncomeTax, 29031.52);
});

test('target-zero mode after July catches up to final annual basis', () => {
  const first = calculateForDate('2026-06-01', {
    ytdRegularPay: 0,
    ytdPriorLumpSums: 0,
    ytdPensionableEarnings: 0,
    ytdEmployeeCpp: 0,
    ytdEmployeeCpp2: 0,
    ytdIncomeTaxWithheld: 0,
    currentGross: 140000,
    taxMode: 'cra-marginal',
    conservativeMode: false,
    conservativeIncrement: 100
  });
  const second = calculateForDate('2026-07-29', {
    ytdRegularPay: 0,
    ytdPriorLumpSums: first.updatedYtd.lumpSums,
    ytdPensionableEarnings: first.updatedYtd.pensionableEarnings,
    ytdEmployeeCpp: first.updatedYtd.employeeCpp,
    ytdEmployeeCpp2: first.updatedYtd.employeeCpp2,
    ytdIncomeTaxWithheld: first.updatedYtd.incomeTaxWithheld,
    currentGross: 140000,
    taxMode: 'target-zero',
    conservativeMode: false,
    conservativeIncrement: 100
  });

  assert.equal(second.valid, true);
  assert.equal(second.tax.taxMode, 'target-zero');
  assert.equal(second.tax.totalIncomeTax, 63213.2);
  assert.equal(second.updatedYtd.incomeTaxWithheld, 96073.72);
  assert.equal(second.tax.comparisonTax.totalIncomeTax, 63031.58);
});

test('target-zero mode after July caps all-post-July withholding at final annual tax', () => {
  const result = calculateForDate('2026-07-29', {
    ytdRegularPay: 0,
    ytdPriorLumpSums: 0,
    ytdPensionableEarnings: 0,
    ytdEmployeeCpp: 0,
    ytdEmployeeCpp2: 0,
    ytdIncomeTaxWithheld: 0,
    currentGross: 280000,
    taxMode: 'target-zero',
    conservativeMode: false,
    conservativeIncrement: 100
  });

  assert.equal(result.valid, true);
  assert.equal(result.tax.totalIncomeTax, 96073.72);
  assert.equal(result.tax.comparisonTax.totalIncomeTax, 96255.35);
});

test('rejects negative inputs', () => {
  const result = calculatePayroll({ ...baseInput, ytdRegularPay: -1 });

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].field, 'ytdRegularPay');
});

test('derives pensionable earnings from YTD income when field is left at zero', () => {
  const result = calculatePayroll({
    ytdRegularPay: 0,
    ytdPriorLumpSums: 80000,
    ytdPensionableEarnings: 0,
    ytdEmployeeCpp: 4230.45,
    ytdEmployeeCpp2: 216,
    ytdIncomeTaxWithheld: 13385.52,
    currentGross: 40000,
    taxMode: 'cra-marginal',
    conservativeMode: false,
    conservativeIncrement: 100
  });

  assert.equal(result.cpp.employeeCpp, 0);
  assert.equal(result.cpp.employeeCpp2, 200);
  assert.equal(result.cpp.totalEmployeeCpp, 200);
  assert.equal(result.updatedYtd.pensionableEarnings, 120000);
});
