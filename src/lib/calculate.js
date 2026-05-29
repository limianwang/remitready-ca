import { getBc2026RatesForDate, getBc2026TargetTaxRatesForDate } from '../rates/ca-bc-2026.js';
import { calculateCpp } from './cpp.js';
import { ceilToIncrement, roundToCents } from './money.js';
import { calculateIncomeTax, calculateTargetZeroIncomeTax } from './tax.js';
import { validateInputs } from './validation.js';

function normalizeInput(input) {
  const derivedPensionableEarnings = roundToCents(input.ytdRegularPay + input.ytdPriorLumpSums);
  return {
    ...input,
    ytdPensionableEarnings: input.ytdPensionableEarnings === 0
      ? derivedPensionableEarnings
      : input.ytdPensionableEarnings
  };
}

function calculateBaseTax(normalizedInput, rates, targetRates) {
  const marginalTax = calculateIncomeTax({ ...normalizedInput, rates });
  const targetZeroTax = calculateTargetZeroIncomeTax({ ...normalizedInput, targetRates });
  return normalizedInput.taxMode === 'cra-marginal'
    ? { tax: marginalTax, comparisonTax: targetZeroTax, taxMode: 'cra-marginal' }
    : { tax: targetZeroTax, comparisonTax: marginalTax, taxMode: 'target-zero' };
}

export function calculatePayroll(
  input,
  rates = getBc2026RatesForDate('2026-01-01'),
  targetRates = getBc2026TargetTaxRatesForDate('2026-01-01')
) {
  const errors = validateInputs(input, rates);
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  const normalizedInput = normalizeInput(input);

  const cpp = calculateCpp({
    ytdPensionableEarnings: normalizedInput.ytdPensionableEarnings,
    ytdEmployeeCpp: normalizedInput.ytdEmployeeCpp,
    ytdEmployeeCpp2: normalizedInput.ytdEmployeeCpp2 ?? 0,
    currentGross: normalizedInput.currentGross,
    rates: rates.cpp
  });

  const { tax: baseTax, comparisonTax, taxMode } = calculateBaseTax(normalizedInput, rates, targetRates);
  const availableForIncomeTax = Math.max(0, roundToCents(normalizedInput.currentGross - cpp.totalEmployeeCpp));
  const uncappedIncomeTax = normalizedInput.conservativeMode
    ? ceilToIncrement(baseTax.totalIncomeTax, normalizedInput.conservativeIncrement)
    : baseTax.totalIncomeTax;
  const totalIncomeTax = Math.min(availableForIncomeTax, uncappedIncomeTax);
  const federalTax = baseTax.totalIncomeTax === 0
    ? 0
    : roundToCents(totalIncomeTax * (baseTax.federalTax / baseTax.totalIncomeTax));
  const bcTax = roundToCents(totalIncomeTax - federalTax);
  const totalEmployeeDeductions = roundToCents(cpp.totalEmployeeCpp + totalIncomeTax);
  const netPay = roundToCents(normalizedInput.currentGross - totalEmployeeDeductions);

  return {
    valid: true,
    errors: [],
    rates,
    currentGross: normalizedInput.currentGross,
    cpp,
    tax: { ...baseTax, federalTax, bcTax, totalIncomeTax, comparisonTax, taxMode },
    totalEmployeeDeductions,
    employerRemittance: roundToCents(cpp.totalEmployerCpp + cpp.totalEmployeeCpp + totalIncomeTax),
    netPay,
    updatedYtd: {
      regularPay: roundToCents(normalizedInput.ytdRegularPay),
      lumpSums: roundToCents(normalizedInput.ytdPriorLumpSums + normalizedInput.currentGross),
      pensionableEarnings: roundToCents(normalizedInput.ytdPensionableEarnings + normalizedInput.currentGross),
      employeeCpp: roundToCents(normalizedInput.ytdEmployeeCpp + cpp.employeeCpp),
      employeeCpp2: roundToCents((normalizedInput.ytdEmployeeCpp2 ?? 0) + cpp.employeeCpp2),
      incomeTaxWithheld: roundToCents(normalizedInput.ytdIncomeTaxWithheld + totalIncomeTax)
    }
  };
}
