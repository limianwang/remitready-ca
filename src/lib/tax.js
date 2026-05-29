import { calculateCpp } from './cpp.js';
import { roundToCents } from './money.js';

function bracketTax(income, brackets) {
  const bracket = brackets.find((item) => income <= item.upTo);
  return Math.max(0, roundToCents(income * bracket.rate - bracket.constant));
}

function estimatedCppCreditsAndDeductions(income, rates) {
  const cpp = calculateCpp({
    ytdPensionableEarnings: 0,
    ytdEmployeeCpp: 0,
    ytdEmployeeCpp2: 0,
    currentGross: income,
    rates: rates.cpp
  });

  return {
    baseCppCredit: cpp.employeeBaseCppPortion,
    additionalCppDeduction: roundToCents(cpp.employeeAdditionalCppPortion + cpp.employeeCpp2)
  };
}

function bcTaxReduction(netIncome, bc) {
  if (netIncome <= bc.taxReductionThreshold) return bc.taxReductionMax;
  if (netIncome >= bc.taxReductionEnd) return 0;
  return roundToCents(Math.max(0, bc.taxReductionMax - (netIncome - bc.taxReductionThreshold) * bc.taxReductionRate));
}

export function annualIncomeTax(income, rates) {
  const cpp = estimatedCppCreditsAndDeductions(income, rates);
  const taxableIncome = Math.max(0, roundToCents(income - cpp.additionalCppDeduction));

  const federalBase = bracketTax(taxableIncome, rates.federal.brackets);
  const federalCredits = roundToCents(
    (rates.federal.basicPersonalAmount + rates.federal.canadaEmploymentAmount + cpp.baseCppCredit) *
      rates.federal.lowestRate
  );
  const federalTax = Math.max(0, roundToCents(federalBase - federalCredits));

  const bcBase = bracketTax(taxableIncome, rates.bc.brackets);
  const bcCredits = roundToCents((rates.bc.basicPersonalAmount + cpp.baseCppCredit) * rates.bc.lowestRate);
  const bcBeforeReduction = Math.max(0, roundToCents(bcBase - bcCredits));
  const bcTax = Math.max(0, roundToCents(bcBeforeReduction - bcTaxReduction(income, rates.bc)));

  return {
    federalTax,
    bcTax,
    totalIncomeTax: roundToCents(federalTax + bcTax),
    taxableIncome
  };
}

export function calculateIncomeTax({ ytdRegularPay, ytdPriorLumpSums, currentGross, rates }) {
  const priorAnnualIncome = ytdRegularPay + ytdPriorLumpSums;
  const afterAnnualIncome = priorAnnualIncome + currentGross;
  const before = annualIncomeTax(priorAnnualIncome, rates);
  const after = annualIncomeTax(afterAnnualIncome, rates);

  const federalTax = Math.max(0, roundToCents(after.federalTax - before.federalTax));
  const bcTax = Math.max(0, roundToCents(after.bcTax - before.bcTax));

  return {
    federalTax,
    bcTax,
    totalIncomeTax: roundToCents(federalTax + bcTax),
    annualBefore: before,
    annualAfter: after,
    method: 'CRA-style lump-sum incremental annual tax estimate'
  };
}

export function calculateTargetZeroIncomeTax({
  ytdRegularPay,
  ytdPriorLumpSums,
  ytdIncomeTaxWithheld,
  currentGross,
  targetRates
}) {
  const afterAnnualIncome = ytdRegularPay + ytdPriorLumpSums + currentGross;
  const after = annualIncomeTax(afterAnnualIncome, targetRates);
  const totalIncomeTax = Math.max(0, roundToCents(after.totalIncomeTax - ytdIncomeTaxWithheld));

  const federalShare = after.totalIncomeTax === 0 ? 0 : after.federalTax / after.totalIncomeTax;
  const federalTax = roundToCents(totalIncomeTax * federalShare);
  const bcTax = roundToCents(totalIncomeTax - federalTax);

  return {
    federalTax,
    bcTax,
    totalIncomeTax,
    annualBefore: null,
    annualAfter: after,
    targetAnnualIncomeTax: after.totalIncomeTax,
    ytdIncomeTaxWithheld,
    method: 'Target zero balance estimate'
  };
}
