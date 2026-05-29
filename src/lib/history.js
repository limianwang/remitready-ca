import { roundToCents } from './money.js';

export function createPaymentRecord({ id, paidOn, taxYear, note, result }) {
  return {
    id,
    kind: 'calculation',
    paidOn,
    taxYear,
    note: note ?? '',
    grossPay: roundToCents(result.currentGross),
    pensionableEarnings: roundToCents(result.currentGross),
    employeeCpp: roundToCents(result.cpp.employeeCpp),
    employeeCpp2: roundToCents(result.cpp.employeeCpp2),
    employerCpp: roundToCents(result.cpp.totalEmployerCpp),
    federalTax: roundToCents(result.tax.federalTax),
    bcTax: roundToCents(result.tax.bcTax),
    incomeTaxWithheld: roundToCents(result.tax.totalIncomeTax),
    netPay: roundToCents(result.netPay),
    employerRemittance: roundToCents(result.employerRemittance)
  };
}

export function createOpeningBalanceRecord({
  id,
  paidOn,
  taxYear,
  grossPay,
  pensionableEarnings,
  employeeCpp,
  employeeCpp2 = 0,
  incomeTaxWithheld,
  note
}) {
  const roundedEmployeeCpp = roundToCents(employeeCpp);
  const roundedEmployeeCpp2 = roundToCents(employeeCpp2);
  const employerCpp = roundToCents(roundedEmployeeCpp + roundedEmployeeCpp2);
  const roundedGrossPay = roundToCents(grossPay);
  const roundedIncomeTax = roundToCents(incomeTaxWithheld);
  return {
    id,
    kind: 'opening-balance',
    paidOn,
    taxYear,
    note: note ?? 'opening YTD balance',
    grossPay: roundedGrossPay,
    pensionableEarnings: roundToCents(pensionableEarnings),
    employeeCpp: roundedEmployeeCpp,
    employeeCpp2: roundedEmployeeCpp2,
    employerCpp,
    federalTax: 0,
    bcTax: roundedIncomeTax,
    incomeTaxWithheld: roundedIncomeTax,
    netPay: roundToCents(roundedGrossPay - roundedEmployeeCpp - roundedEmployeeCpp2 - roundedIncomeTax),
    employerRemittance: roundToCents(roundedIncomeTax + roundedEmployeeCpp + roundedEmployeeCpp2 + employerCpp)
  };
}

export function deriveYtdFromHistory(records, taxYear) {
  const yearRecords = records.filter((record) => record.taxYear === taxYear);
  return yearRecords.reduce((totals, record) => ({
    ytdPriorLumpSums: roundToCents(totals.ytdPriorLumpSums + record.grossPay),
    ytdPensionableEarnings: roundToCents(totals.ytdPensionableEarnings + (record.pensionableEarnings ?? record.grossPay)),
    ytdEmployeeCpp: roundToCents(totals.ytdEmployeeCpp + record.employeeCpp),
    ytdEmployeeCpp2: roundToCents(totals.ytdEmployeeCpp2 + (record.employeeCpp2 ?? 0)),
    ytdIncomeTaxWithheld: roundToCents(totals.ytdIncomeTaxWithheld + record.incomeTaxWithheld)
  }), {
    ytdPriorLumpSums: 0,
    ytdPensionableEarnings: 0,
    ytdEmployeeCpp: 0,
    ytdEmployeeCpp2: 0,
    ytdIncomeTaxWithheld: 0
  });
}

export function validateHistoryPayload(payload) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.records)) {
    return { valid: false, errors: ['Imported file must contain version 1 and records array.'] };
  }

  const errors = [];
  payload.records.forEach((record, index) => {
    for (const field of ['taxYear', 'grossPay', 'employeeCpp', 'incomeTaxWithheld']) {
      if (!Number.isFinite(record[field])) {
        errors.push(`Record ${index + 1}: ${field} must be numeric.`);
      }
    }
    for (const field of ['grossPay', 'employeeCpp', 'employeeCpp2', 'employerCpp', 'incomeTaxWithheld', 'netPay', 'employerRemittance']) {
      if (Number.isFinite(record[field]) && record[field] < 0) {
        errors.push(`Record ${index + 1}: ${field} cannot be negative.`);
      }
    }
    if (Number.isFinite(record.pensionableEarnings) && record.pensionableEarnings < 0) {
      errors.push(`Record ${index + 1}: pensionableEarnings cannot be negative.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function validateYearEndPosition({ records, taxYear, estimatedAnnualIncomeTax }) {
  const yearRecords = records.filter((record) => record.taxYear === taxYear);
  const totalGrossPay = roundToCents(yearRecords.reduce((sum, record) => sum + record.grossPay, 0));
  const totalIncomeTaxWithheld = roundToCents(yearRecords.reduce((sum, record) => sum + record.incomeTaxWithheld, 0));
  const totalEmployeeCpp = roundToCents(yearRecords.reduce((sum, record) => sum + record.employeeCpp + (record.employeeCpp2 ?? 0), 0));
  const projectedBalance = roundToCents(estimatedAnnualIncomeTax - totalIncomeTaxWithheld);
  const status = Math.abs(projectedBalance) <= 100
    ? 'near-zero'
    : projectedBalance > 0
      ? 'under-withheld'
      : 'over-withheld';

  return { totalGrossPay, totalEmployeeCpp, totalIncomeTaxWithheld, estimatedAnnualIncomeTax, projectedBalance, status };
}
