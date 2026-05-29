import './styles.css';
import Alpine from 'alpinejs';
import { calculatePayroll } from './lib/calculate.js';
import { getInspectableRates, getRatePeriodRows } from './lib/constantsView.js';
import {
  createOpeningBalanceRecord,
  createPaymentRecord,
  deriveYtdFromHistory,
  validateYearEndPosition
} from './lib/history.js';
import { exportHistoryJson, getHistoryExportFilename, importHistoryJson } from './lib/jsonHistory.js';
import { formatMoney, parseMoney, roundToCents } from './lib/money.js';
import { annualIncomeTax } from './lib/tax.js';
import {
  HISTORY_YTD_FIELDS,
  applyHistoryYtdToForm,
  getChangedHistoryYtdFields
} from './lib/ytdForm.js';
import {
  BC_2026_RATES,
  getBc2026AnnualTaxRates,
  getBc2026RatesForDate,
  getBc2026TargetTaxRatesForDate
} from './rates/ca-bc-2026.js';

function readForm(form) {
  const ytdRegularPay = parseMoney(form.ytdRegularPay);
  const ytdPriorLumpSums = parseMoney(form.ytdPriorLumpSums);
  const enteredPensionableEarnings = parseMoney(form.ytdPensionableEarnings);
  return {
    ytdRegularPay,
    ytdPriorLumpSums,
    ytdPensionableEarnings: enteredPensionableEarnings === 0
      ? roundToCents(ytdRegularPay + ytdPriorLumpSums)
      : enteredPensionableEarnings,
    ytdEmployeeCpp: parseMoney(form.ytdEmployeeCpp),
    ytdEmployeeCpp2: parseMoney(form.ytdEmployeeCpp2),
    ytdIncomeTaxWithheld: parseMoney(form.ytdIncomeTaxWithheld),
    currentGross: parseMoney(form.currentGross),
    taxMode: form.taxMode,
    conservativeMode: Boolean(form.conservativeMode),
    conservativeIncrement: Number(form.conservativeIncrement)
  };
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatAccountingMoney(value) {
  const rounded = roundToCents(value);
  return rounded < 0 ? `(${formatMoney(Math.abs(rounded))})` : formatMoney(rounded);
}

function getRatesForDate(date) {
  return getBc2026RatesForDate(date);
}

function formSignature(form) {
  return JSON.stringify({
    paidOn: form.paidOn,
    currentGross: form.currentGross,
    ytdRegularPay: form.ytdRegularPay,
    ytdPriorLumpSums: form.ytdPriorLumpSums,
    ytdPensionableEarnings: form.ytdPensionableEarnings,
    ytdEmployeeCpp: form.ytdEmployeeCpp,
    ytdEmployeeCpp2: form.ytdEmployeeCpp2,
    ytdIncomeTaxWithheld: form.ytdIncomeTaxWithheld,
    taxMode: form.taxMode,
    conservativeMode: Boolean(form.conservativeMode),
    conservativeIncrement: form.conservativeIncrement
  });
}

Alpine.data('remitReadyCalculator', () => ({
  taxYear: 2026,
  activeView: 'calculator',
  form: {
    paidOn: new Date().toISOString().slice(0, 10),
    currentGross: '10000',
    ytdRegularPay: '0',
    ytdPriorLumpSums: '0',
    ytdPensionableEarnings: '0',
    ytdEmployeeCpp: '0',
    ytdEmployeeCpp2: '0',
    ytdIncomeTaxWithheld: '0',
    taxMode: 'target-zero',
    conservativeMode: true,
    conservativeIncrement: '100'
  },
  result: null,
  resultSignature: null,
  errors: [],
  history: [],
  historyMessage: '',
  touchedYtdFields: {},
  hasUnsavedChanges: false,
  helpDialog: null,
  inspectedEffectivePeriod: '',
  fieldHelp: {
    paidOn: {
      title: 'Payment date',
      body: 'The date the current payroll payment is paid.',
      effect: 'The calculator uses this date to choose the CRA source constants. Payments before July 1 use the January 2026 constants; payments on or after July 1 use the July 2026 constants.'
    },
    currentGross: {
      title: 'Current lump-sum gross',
      body: 'The gross salary amount you want to pay now, before income tax, CPP, and CPP2 deductions.',
      effect: 'The result panel calculates deductions for this payment only.'
    },
    ytdRegularPay: {
      title: 'YTD regular salary/wages before this payment',
      body: 'The total recurring payroll salary or wages already paid in this tax year before the current payment. This is a year-to-date total, not a monthly amount.',
      effect: 'Used with prior ad hoc lump sums to estimate the annual tax bracket before this payment.'
    },
    ytdPriorLumpSums: {
      title: 'YTD prior ad hoc lump-sum salary',
      body: 'The total previous one-off salary payments already paid in this tax year. This is also a year-to-date total.',
      effect: 'Used to calculate the marginal income tax on the current lump sum and to derive CPP pensionable earnings when that field is left at zero.'
    },
    ytdPensionableEarnings: {
      title: 'YTD CPP pensionable earnings',
      body: 'The prior year-to-date earnings that count toward CPP and CPP2 limits. For normal salary payroll, this is usually regular salary/wages plus prior ad hoc lump-sum salary.',
      effect: 'If this field is zero, the calculator derives it automatically. If you enter a different number, that number overrides the derived value and changes only the CPP/CPP2 room calculation, not the income tax bracket.'
    },
    ytdEmployeeCpp: {
      title: 'YTD employee CPP already withheld',
      body: 'The base CPP already deducted from employee pay earlier in the tax year.',
      effect: 'Used to avoid deducting base CPP beyond the annual maximum.'
    },
    ytdEmployeeCpp2: {
      title: 'YTD employee CPP2 already withheld',
      body: 'The CPP2 already deducted from employee pay earlier in the tax year.',
      effect: 'Used to calculate remaining CPP2 room between YMPE and YAMPE.'
    },
    ytdIncomeTaxWithheld: {
      title: 'YTD income tax already withheld',
      body: 'Income tax already deducted from earlier payroll payments in the tax year.',
      effect: 'Used by target-zero mode and the year-end position estimate. Target-zero mode subtracts this from estimated tax to target a near-zero balance.'
    },
    taxMode: {
      title: 'Tax mode',
      body: 'Target zero balance uses actual YTD withholding and the payment-date target basis. Before July it targets the January payroll basis; from July onward it targets the final annual basis. CRA marginal estimate calculates only the marginal tax on the current lump sum.',
      effect: 'Use target zero balance for owner-operator planning. Use CRA marginal estimate only when comparing against CRA-style lump-sum withholding.'
    },
    conservativeMode: {
      title: 'Conservative mode',
      body: 'Rounds the current payment income tax withholding up by the selected offset.',
      effect: 'This intentionally over-withholds income tax to reduce underpayment risk.'
    }
  },

  init() {
    this.calculate();
  },

  money(value) {
    return formatMoney(value);
  },

  get rates() {
    return {
      ...getRatesForDate(this.form.paidOn),
      sourceNotes: BC_2026_RATES.sourceNotes
    };
  },

  get inspectedRates() {
    return {
      ...getInspectableRates(this.ratePeriods, this.rates, this.inspectedEffectivePeriod),
      sourceNotes: BC_2026_RATES.sourceNotes
    };
  },

  get targetRates() {
    return getBc2026TargetTaxRatesForDate(this.form.paidOn);
  },

  get ratePeriods() {
    return BC_2026_RATES.payrollPeriods.map((period) => getBc2026RatesForDate(period.effectiveFrom));
  },

  get annualRates() {
    return getBc2026AnnualTaxRates();
  },

  get annualBasisRows() {
    const bc = this.annualRates.bc;
    return [
      { label: 'Final BC lowest rate', value: `${(bc.lowestRate * 100).toFixed(2)}%` },
      { label: 'Final BC tax reduction max', value: formatMoney(bc.taxReductionMax) },
      { label: 'Final BC tax reduction end', value: formatMoney(bc.taxReductionEnd) }
    ];
  },

  get ratePeriodRows() {
    return getRatePeriodRows({
      periods: this.ratePeriods,
      activeEffectivePeriod: this.rates.effectivePeriod,
      inspectedEffectivePeriod: this.inspectedRates.effectivePeriod
    });
  },

  inspectRatePeriod(effectivePeriod) {
    this.inspectedEffectivePeriod = effectivePeriod;
  },

  openHelp(key) {
    this.helpDialog = this.fieldHelp[key];
  },

  closeHelp() {
    this.helpDialog = null;
  },

  calculate() {
    const result = calculatePayroll(readForm(this.form), this.rates, this.targetRates);
    this.result = result.valid ? result : null;
    this.resultSignature = result.valid ? formSignature(this.form) : null;
    this.errors = result.errors ?? [];
  },

  get canAddCurrentPayment() {
    return Boolean(this.result) && this.resultSignature === formSignature(this.form);
  },

  markYtdFieldTouched(field) {
    this.touchedYtdFields = { ...this.touchedYtdFields, [field]: true };
  },

  clearTouchedYtdFields(fields = HISTORY_YTD_FIELDS) {
    const nextTouched = { ...this.touchedYtdFields };
    for (const field of fields) {
      delete nextTouched[field];
    }
    this.touchedYtdFields = nextTouched;
  },

  get touchedChangedYtdFields() {
    if (this.history.length === 0) return [];
    const ytd = deriveYtdFromHistory(this.history, this.taxYear);
    return getChangedHistoryYtdFields(this.form, ytd, Object.keys(this.touchedYtdFields));
  },

  applyHistoryYtd(message, fields = HISTORY_YTD_FIELDS) {
    if (this.history.length === 0) return;
    const displayMessage = typeof message === 'string'
      ? message
      : 'Restored touched YTD fields from saved history.';
    const ytd = deriveYtdFromHistory(this.history, this.taxYear);
    applyHistoryYtdToForm(this.form, ytd, fields);
    this.clearTouchedYtdFields(fields);
    this.historyMessage = displayMessage;
  },

  resetTouchedYtdFields() {
    const fields = this.touchedChangedYtdFields;
    if (fields.length === 0) return;
    this.applyHistoryYtd(undefined, fields);
  },

  addCurrentPayment() {
    if (!this.canAddCurrentPayment) {
      this.errors = [{ field: 'result', message: 'Calculate this payment before adding it to history.' }];
      return;
    }
    const record = createPaymentRecord({
      id: `pay_${Date.now()}`,
      paidOn: this.form.paidOn,
      taxYear: this.taxYear,
      note: 'ad hoc payroll',
      result: this.result
    });
    this.history = [...this.history, record];
    const ytd = deriveYtdFromHistory(this.history, this.taxYear);
    applyHistoryYtdToForm(this.form, ytd);
    this.clearTouchedYtdFields();
    this.resultSignature = null;
    this.hasUnsavedChanges = true;
    this.historyMessage = 'Added this calculation to session history and refreshed YTD fields for the next payment.';
  },

  addOpeningBalance() {
    const ytd = readForm(this.form);
    const grossPay = roundToCents(ytd.ytdRegularPay + ytd.ytdPriorLumpSums);
    const pensionableEarnings = roundToCents(ytd.ytdPensionableEarnings);
    const employeeCpp = roundToCents(ytd.ytdEmployeeCpp);
    const employeeCpp2 = roundToCents(ytd.ytdEmployeeCpp2);
    const incomeTaxWithheld = roundToCents(ytd.ytdIncomeTaxWithheld);
    const hasOpeningBalance = [grossPay, pensionableEarnings, employeeCpp, employeeCpp2, incomeTaxWithheld]
      .some((value) => value > 0);
    if (!hasOpeningBalance) {
      this.errors = [{ field: 'history', message: 'Enter prior YTD amounts before adding an opening balance.' }];
      return;
    }

    const record = createOpeningBalanceRecord({
      id: `opening_${Date.now()}`,
      paidOn: new Date().toISOString().slice(0, 10),
      taxYear: this.taxYear,
      grossPay,
      pensionableEarnings,
      employeeCpp,
      employeeCpp2,
      incomeTaxWithheld
    });
    this.history = [...this.history, record];
    this.clearTouchedYtdFields();
    this.hasUnsavedChanges = true;
    this.historyMessage = 'Added opening YTD balance to session history. Export JSON to preserve prior payroll context.';
    this.errors = [];
  },

  async importHistory(event) {
    const [file] = event.target.files;
    if (!file) return;
    try {
      this.history = importHistoryJson(await file.text());
      this.hasUnsavedChanges = false;
      this.errors = [];
      this.applyHistoryYtd(`Imported ${this.history.length} payment records from ${file.name} and loaded them into the YTD fields.`);
    } catch (error) {
      this.errors = [{ field: 'history', message: error.message }];
    } finally {
      event.target.value = '';
    }
  },

  exportHistory() {
    if (this.history.length === 0) {
      this.errors = [{ field: 'history', message: 'No payment history to export.' }];
      return;
    }
    const exportedAt = new Date().toISOString();
    const filename = getHistoryExportFilename(this.taxYear, exportedAt);
    downloadText(filename, exportHistoryJson(this.history, exportedAt));
    this.hasUnsavedChanges = false;
    this.historyMessage = `Downloaded ${filename}. Import that file next time to restore history.`;
    this.errors = [];
  },

  clearHistory() {
    this.history = [];
    this.hasUnsavedChanges = false;
    this.historyMessage = 'Session history cleared. Exported JSON files are unchanged.';
    this.calculate();
  },

  get employeeDeductionMetrics() {
    if (!this.result) {
      return [
        { label: 'Income tax withheld', value: '$0.00', detail: 'Federal $0.00 + BC $0.00' },
        { label: 'Employee CPP total', value: '$0.00', detail: 'CPP $0.00 + CPP2 $0.00' },
        { label: 'Net pay', value: '$0.00', detail: 'Gross less employee deductions' }
      ];
    }
    return [
      {
        label: 'Income tax withheld',
        value: formatMoney(this.result.tax.totalIncomeTax),
        detail: `Federal ${formatMoney(this.result.tax.federalTax)} + BC ${formatMoney(this.result.tax.bcTax)}`
      },
      {
        label: 'Employee CPP total',
        value: formatMoney(this.result.cpp.totalEmployeeCpp),
        detail: `CPP ${formatMoney(this.result.cpp.employeeCpp)} + CPP2 ${formatMoney(this.result.cpp.employeeCpp2)}`
      },
      {
        label: 'Net pay',
        value: formatMoney(this.result.netPay),
        detail: `${formatMoney(this.result.currentGross)} gross - ${formatMoney(this.result.totalEmployeeDeductions)} deductions`
      }
    ];
  },

  get remittanceMetrics() {
    if (!this.result) {
      return [
        { label: 'Payroll deductions payable', value: '$0.00', detail: 'Income tax + employee CPP/CPP2' },
        { label: 'Employer CPP expense', value: '$0.00', detail: 'Employer CPP + CPP2' },
        { label: 'CRA remittance total', value: '$0.00', detail: 'Total cash remitted to CRA' }
      ];
    }
    const employeePayrollPayable = roundToCents(this.result.tax.totalIncomeTax + this.result.cpp.totalEmployeeCpp);
    return [
      {
        label: 'Payroll deductions payable',
        value: formatMoney(employeePayrollPayable),
        detail: `${formatMoney(this.result.tax.totalIncomeTax)} tax + ${formatMoney(this.result.cpp.totalEmployeeCpp)} employee CPP/CPP2`
      },
      {
        label: 'Employer CPP expense',
        value: formatMoney(this.result.cpp.totalEmployerCpp),
        detail: `CPP ${formatMoney(this.result.cpp.employerCpp)} + CPP2 ${formatMoney(this.result.cpp.employerCpp2)}`
      },
      {
        label: 'CRA remittance total',
        value: formatMoney(this.result.employerRemittance),
        detail: 'Income tax + employee CPP/CPP2 + employer CPP/CPP2'
      }
    ];
  },

  get employerCostMetrics() {
    if (!this.result) {
      return [
        { label: 'Salaries and wages', value: '$0.00', detail: 'Gross payroll expense' },
        { label: 'Total employer cost', value: '$0.00', detail: 'Gross payroll + employer CPP/CPP2' }
      ];
    }
    return [
      {
        label: 'Salaries and wages',
        value: formatMoney(this.result.currentGross),
        detail: 'Gross payroll expense'
      },
      {
        label: 'Total employer cost',
        value: formatMoney(roundToCents(this.result.currentGross + this.result.cpp.totalEmployerCpp)),
        detail: `${formatMoney(this.result.currentGross)} gross + ${formatMoney(this.result.cpp.totalEmployerCpp)} employer CPP/CPP2`
      }
    ];
  },

  get taxComparison() {
    if (!this.result?.tax?.comparisonTax) return null;
    const comparison = this.result.tax.comparisonTax;
    const difference = roundToCents(this.result.tax.totalIncomeTax - comparison.totalIncomeTax);
    const label = this.result.tax.taxMode === 'target-zero'
      ? 'Compared with CRA marginal estimate'
      : 'Compared with target zero balance';
    const detail = difference === 0
      ? 'Same income tax withholding under both modes.'
      : difference > 0
        ? `${formatMoney(difference)} more than comparison mode.`
        : `${formatMoney(Math.abs(difference))} less than comparison mode.`;
    return {
      label,
      current: formatMoney(this.result.tax.totalIncomeTax),
      comparison: formatMoney(comparison.totalIncomeTax),
      detail
    };
  },

  get validator() {
    const ytd = deriveYtdFromHistory(this.history, this.taxYear);
    const annual = annualIncomeTax(ytd.ytdPriorLumpSums, getBc2026AnnualTaxRates());
    return validateYearEndPosition({
      records: this.history,
      taxYear: this.taxYear,
      estimatedAnnualIncomeTax: annual.totalIncomeTax
    });
  },

  get validatorClass() {
    return {
      'text-muted': this.validator.status === 'near-zero',
      'text-danger': this.validator.status === 'under-withheld',
      'text-teal-dark': this.validator.status === 'over-withheld'
    };
  },

  get validatorMetrics() {
    const validator = this.validator;
    const balanceLabel = validator.projectedBalance < 0 ? 'Projected refund' : 'Projected tax owing';
    const balanceDetail = validator.projectedBalance < 0
      ? 'Refund estimate shown in brackets because withholding exceeds estimated tax.'
      : validator.projectedBalance > 0
        ? 'Estimated amount still owing if no more withholding happens.'
        : 'Withholding equals estimated tax.';
    return [
      { label: 'Saved gross pay', value: formatMoney(validator.totalGrossPay) },
      { label: 'Saved employee CPP', value: formatMoney(validator.totalEmployeeCpp) },
      { label: 'Tax withheld', value: formatMoney(validator.totalIncomeTaxWithheld) },
      { label: 'Estimated annual tax', value: formatMoney(validator.estimatedAnnualIncomeTax) },
      { label: balanceLabel, value: formatAccountingMoney(validator.projectedBalance), detail: balanceDetail }
    ];
  },

  get historyYtdMetrics() {
    const ytd = deriveYtdFromHistory(this.history, this.taxYear);
    return [
      { label: 'Prior ad hoc lump-sum salary', value: formatMoney(ytd.ytdPriorLumpSums) },
      { label: 'CPP pensionable earnings', value: formatMoney(ytd.ytdPensionableEarnings) },
      { label: 'Employee CPP withheld', value: formatMoney(ytd.ytdEmployeeCpp) },
      { label: 'Employee CPP2 withheld', value: formatMoney(ytd.ytdEmployeeCpp2) },
      { label: 'Income tax withheld', value: formatMoney(ytd.ytdIncomeTaxWithheld) }
    ];
  },

  get historyApplyPreview() {
    const ytd = deriveYtdFromHistory(this.history, this.taxYear);
    const changedFields = this.touchedChangedYtdFields;
    const canApply = changedFields.length > 0;
    return {
      canApply,
      status: canApply
        ? `Recovery action: restores ${changedFields.length} touched YTD field${changedFields.length === 1 ? '' : 's'} from ${formatMoney(ytd.ytdPriorLumpSums)} saved gross pay.`
        : this.history.length > 0
          ? 'YTD fields match saved history.'
          : 'Import JSON or add an opening balance/current payment first.'
    };
  },

  get historyCountLabel() {
    return this.history.length === 0 ? 'Empty' : `${this.history.length} saved`;
  },

  get openingBalancePreview() {
    const ytd = readForm(this.form);
    const grossPay = roundToCents(ytd.ytdRegularPay + ytd.ytdPriorLumpSums);
    const pensionableEarnings = roundToCents(ytd.ytdPensionableEarnings);
    const employeeCpp = roundToCents(ytd.ytdEmployeeCpp);
    const employeeCpp2 = roundToCents(ytd.ytdEmployeeCpp2);
    const incomeTaxWithheld = roundToCents(ytd.ytdIncomeTaxWithheld);
    const canAdd = [grossPay, pensionableEarnings, employeeCpp, employeeCpp2, incomeTaxWithheld]
      .some((value) => value > 0);

    return {
      canAdd,
      status: canAdd
        ? `Ready to save ${formatMoney(grossPay)} prior gross pay to JSON history.`
        : 'Enter prior YTD amounts in the form to enable this.',
      grossPay,
      pensionableEarnings,
      employeeCpp,
      employeeCpp2,
      incomeTaxWithheld
    };
  },

  get historyRows() {
    return this.history.map((record, index) => ({
      ...record,
      rowNumber: index + 1,
      typeLabel: record.kind === 'opening-balance' ? 'Opening balance' : 'Calculated payment',
      employeeCppTotal: roundToCents(record.employeeCpp + (record.employeeCpp2 ?? 0)),
      pensionableEarnings: roundToCents(record.pensionableEarnings ?? record.grossPay),
      incomeTaxDetail: record.kind === 'opening-balance'
        ? 'prior withholding'
        : `${formatMoney(record.federalTax)} / ${formatMoney(record.bcTax)}`
    }));
  },

  get cppConstantRows() {
    const cpp = this.inspectedRates.cpp;
    return [
      { label: 'YMPE', value: formatMoney(cpp.ympe), note: 'Maximum pensionable earnings for base CPP' },
      { label: 'YAMPE', value: formatMoney(cpp.yampe), note: 'Upper earnings limit for CPP2' },
      { label: 'Basic exemption', value: formatMoney(cpp.basicExemption), note: 'Annual CPP exemption' },
      { label: 'Base CPP rate', value: `${(cpp.cppRate * 100).toFixed(2)}%`, note: 'Employee and employer rate' },
      { label: 'CPP2 rate', value: `${(cpp.cpp2Rate * 100).toFixed(2)}%`, note: 'Employee and employer rate above YMPE' },
      { label: 'Max CPP', value: formatMoney(cpp.maxCpp), note: 'Annual employee/employer base CPP maximum' },
      { label: 'Max CPP2', value: formatMoney(cpp.maxCpp2), note: 'Annual employee/employer CPP2 maximum' }
    ];
  },

  get federalCreditRows() {
    return [
      { label: 'Basic personal amount', value: formatMoney(this.inspectedRates.federal.basicPersonalAmount) },
      { label: 'Canada employment amount', value: formatMoney(this.inspectedRates.federal.canadaEmploymentAmount) },
      { label: 'Lowest federal rate', value: `${(this.inspectedRates.federal.lowestRate * 100).toFixed(2)}%` }
    ];
  },

  get bcCreditRows() {
    const bc = this.inspectedRates.bc;
    return [
      { label: 'BC basic personal amount', value: formatMoney(bc.basicPersonalAmount) },
      { label: 'Lowest BC rate', value: `${(bc.lowestRate * 100).toFixed(2)}%` },
      { label: 'BC tax reduction max', value: formatMoney(bc.taxReductionMax) },
      { label: 'Tax reduction threshold', value: formatMoney(bc.taxReductionThreshold) },
      { label: 'Tax reduction end', value: formatMoney(bc.taxReductionEnd) },
      { label: 'Tax reduction phase-out rate', value: `${(bc.taxReductionRate * 100).toFixed(2)}%` }
    ];
  },

  get federalBracketRows() {
    return this.inspectedRates.federal.brackets.map((bracket, index, brackets) => ({
      range: `${index === 0 ? '$0.00' : formatMoney(brackets[index - 1].upTo + 0.01)} - ${bracket.upTo > 1e50 ? 'and over' : formatMoney(bracket.upTo)}`,
      rate: `${(bracket.rate * 100).toFixed(2)}%`,
      constant: formatMoney(bracket.constant)
    }));
  },

  get bcBracketRows() {
    return this.inspectedRates.bc.brackets.map((bracket, index, brackets) => ({
      range: `${index === 0 ? '$0.00' : formatMoney(brackets[index - 1].upTo + 0.01)} - ${bracket.upTo > 1e50 ? 'and over' : formatMoney(bracket.upTo)}`,
      rate: `${(bracket.rate * 100).toFixed(2)}%`,
      constant: formatMoney(bracket.constant)
    }));
  },

  get validatorSummary() {
    const balance = this.validator.projectedBalance;
    if (balance < 0) return `${formatAccountingMoney(balance)} = estimated refund / over-withheld tax.`;
    if (balance > 0) return `${formatAccountingMoney(balance)} = estimated tax still owing.`;
    return 'Projected tax owing is zero based on imported/new JSON history.';
  }
}));

window.Alpine = Alpine;
Alpine.start();
