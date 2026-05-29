import { roundToCents } from './money.js';

function boundedAmount(value, lower, upper) {
  return Math.min(Math.max(value - lower, 0), upper - lower);
}

export function calculateCpp({ ytdPensionableEarnings, ytdEmployeeCpp, ytdEmployeeCpp2 = 0, currentGross, rates }) {
  const pensionableBefore = Math.max(0, ytdPensionableEarnings);
  const pensionableAfter = Math.max(pensionableBefore, pensionableBefore + currentGross);

  const cppBaseAfter = boundedAmount(pensionableAfter, rates.basicExemption, rates.ympe);
  const cppDueToDate = roundToCents(cppBaseAfter * rates.cppRate);
  const employeeCpp = Math.max(0, roundToCents(Math.min(rates.maxCpp, cppDueToDate) - ytdEmployeeCpp));

  const cpp2BaseAfter = boundedAmount(pensionableAfter, rates.ympe, rates.yampe);
  const cpp2DueToDate = roundToCents(cpp2BaseAfter * rates.cpp2Rate);
  const employeeCpp2 = Math.max(0, roundToCents(Math.min(rates.maxCpp2, cpp2DueToDate) - ytdEmployeeCpp2));

  const employeeBaseCppPortion = roundToCents(employeeCpp * (rates.baseRate / rates.cppRate));
  const employeeAdditionalCppPortion = roundToCents(employeeCpp - employeeBaseCppPortion);

  return {
    employeeCpp,
    employerCpp: employeeCpp,
    employeeCpp2,
    employerCpp2: employeeCpp2,
    employeeBaseCppPortion,
    employeeAdditionalCppPortion,
    totalEmployeeCpp: roundToCents(employeeCpp + employeeCpp2),
    totalEmployerCpp: roundToCents(employeeCpp + employeeCpp2)
  };
}
