function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function validateKnownFields(errors, object, path, knownFields) {
  if (!isPlainObject(object)) return;
  for (const key of Object.keys(object)) {
    if (!knownFields.includes(key)) {
      addError(errors, `${path}.${key}`, 'is not a supported field');
    }
  }
}

function requireString(errors, object, path, field) {
  if (typeof object[field] !== 'string' || object[field].trim() === '') {
    addError(errors, `${path}.${field}`, 'must be a non-empty string');
  }
}

function requireDate(errors, object, path, field) {
  if (!isIsoDate(object[field])) {
    addError(errors, `${path}.${field}`, 'must be an ISO date string in YYYY-MM-DD format');
  }
}

function requireNumber(errors, object, path, field, options = {}) {
  const value = object[field];
  if (!Number.isFinite(value)) {
    addError(errors, `${path}.${field}`, 'must be a finite number');
    return;
  }
  if (options.min !== undefined && value < options.min) {
    addError(errors, `${path}.${field}`, `must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    addError(errors, `${path}.${field}`, `must be at most ${options.max}`);
  }
}

function validateBracketTable(errors, brackets, path) {
  if (!Array.isArray(brackets) || brackets.length === 0) {
    addError(errors, path, 'must be a non-empty array');
    return;
  }

  let previousLimit = -Infinity;
  brackets.forEach((bracket, index) => {
    const bracketPath = `${path}[${index}]`;
    if (!isPlainObject(bracket)) {
      addError(errors, bracketPath, 'must be an object');
      return;
    }
    requireNumber(errors, bracket, bracketPath, 'upTo', { min: 0 });
    requireNumber(errors, bracket, bracketPath, 'rate', { min: 0, max: 1 });
    requireNumber(errors, bracket, bracketPath, 'constant', { min: 0 });

    if (Number.isFinite(bracket.upTo) && bracket.upTo <= previousLimit) {
      addError(errors, `${bracketPath}.upTo`, 'must be greater than the previous bracket limit');
    }
    previousLimit = bracket.upTo;
  });
}

function validateCpp(errors, cpp, path) {
  if (!isPlainObject(cpp)) {
    addError(errors, path, 'must be an object');
    return;
  }

  for (const field of ['ympe', 'yampe', 'basicExemption', 'maxCpp', 'maxCpp2']) {
    requireNumber(errors, cpp, path, field, { min: 0 });
  }
  for (const field of ['baseRate', 'firstAdditionalRate', 'cppRate', 'cpp2Rate']) {
    requireNumber(errors, cpp, path, field, { min: 0, max: 1 });
  }

  if (Number.isFinite(cpp.ympe) && Number.isFinite(cpp.yampe) && cpp.yampe < cpp.ympe) {
    addError(errors, `${path}.yampe`, 'must be greater than or equal to YMPE');
  }
}

function validateFederal(errors, federal, path) {
  if (!isPlainObject(federal)) {
    addError(errors, path, 'must be an object');
    return;
  }

  requireNumber(errors, federal, path, 'lowestRate', { min: 0, max: 1 });
  requireNumber(errors, federal, path, 'basicPersonalAmount', { min: 0 });
  requireNumber(errors, federal, path, 'canadaEmploymentAmount', { min: 0 });
  validateBracketTable(errors, federal.brackets, `${path}.brackets`);
}

function validateBc(errors, bc, path) {
  if (!isPlainObject(bc)) {
    addError(errors, path, 'must be an object');
    return;
  }

  requireNumber(errors, bc, path, 'lowestRate', { min: 0, max: 1 });
  requireNumber(errors, bc, path, 'basicPersonalAmount', { min: 0 });
  requireNumber(errors, bc, path, 'taxReductionMax', { min: 0 });
  requireNumber(errors, bc, path, 'taxReductionThreshold', { min: 0 });
  requireNumber(errors, bc, path, 'taxReductionEnd', { min: 0 });
  requireNumber(errors, bc, path, 'taxReductionRate', { min: 0, max: 1 });
  validateBracketTable(errors, bc.brackets, `${path}.brackets`);

  if (
    Number.isFinite(bc.taxReductionThreshold)
    && Number.isFinite(bc.taxReductionEnd)
    && bc.taxReductionEnd < bc.taxReductionThreshold
  ) {
    addError(errors, `${path}.taxReductionEnd`, 'must be greater than or equal to the tax reduction threshold');
  }
}

function validateRatePeriod(errors, period, path) {
  if (!isPlainObject(period)) {
    addError(errors, path, 'must be an object');
    return;
  }

  requireNumber(errors, period, path, 'taxYear', { min: 2000, max: 2100 });
  requireString(errors, period, path, 'jurisdiction');
  requireString(errors, period, path, 'effectivePeriod');
  requireDate(errors, period, path, 'effectiveFrom');
  requireDate(errors, period, path, 'effectiveTo');
  requireString(errors, period, path, 'sourceUrl');
  requireString(errors, period, path, 'source');
  validateCpp(errors, period.cpp, `${path}.cpp`);
  validateFederal(errors, period.federal, `${path}.federal`);
  validateBc(errors, period.bc, `${path}.bc`);

  if (isIsoDate(period.effectiveFrom) && isIsoDate(period.effectiveTo) && period.effectiveTo < period.effectiveFrom) {
    addError(errors, `${path}.effectiveTo`, 'must be on or after effectiveFrom');
  }
}

function deepMerge(base, overrides = {}) {
  if (Array.isArray(base) || Array.isArray(overrides)) {
    return overrides === undefined ? structuredClone(base) : structuredClone(overrides);
  }
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return overrides === undefined ? structuredClone(base) : structuredClone(overrides);
  }
  const merged = structuredClone(base);
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = key in merged ? deepMerge(merged[key], value) : structuredClone(value);
  }
  return merged;
}

function validatePayrollPeriod(errors, period, path) {
  if (!isPlainObject(period)) {
    addError(errors, path, 'must be an object');
    return;
  }

  requireString(errors, period, path, 'effectivePeriod');
  requireDate(errors, period, path, 'effectiveFrom');
  requireDate(errors, period, path, 'effectiveTo');
  requireString(errors, period, path, 'sourceUrl');
  requireString(errors, period, path, 'source');

  if (period.overrides !== undefined && !isPlainObject(period.overrides)) {
    addError(errors, `${path}.overrides`, 'must be an object when present');
  }
  if (isPlainObject(period.overrides)) {
    validateKnownFields(errors, period.overrides, `${path}.overrides`, ['cpp', 'federal', 'bc']);
  }
  if (isIsoDate(period.effectiveFrom) && isIsoDate(period.effectiveTo) && period.effectiveTo < period.effectiveFrom) {
    addError(errors, `${path}.effectiveTo`, 'must be on or after effectiveFrom');
  }
}

export function resolvePayrollPeriodRates(annualTax, period) {
  return {
    ...deepMerge(annualTax, period.overrides ?? {}),
    effectivePeriod: period.effectivePeriod,
    effectiveFrom: period.effectiveFrom,
    effectiveTo: period.effectiveTo,
    sourceUrl: period.sourceUrl,
    source: period.source,
    payrollOverrides: period.overrides ?? {}
  };
}

export function validateRatesPayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return { valid: false, errors: ['rates: must be an object'] };
  }

  requireNumber(errors, payload, 'rates', 'taxYear', { min: 2000, max: 2100 });
  requireString(errors, payload, 'rates', 'jurisdiction');
  validateRatePeriod(errors, payload.annualTax, 'rates.annualTax');

  if (!Array.isArray(payload.payrollPeriods) || payload.payrollPeriods.length === 0) {
    addError(errors, 'rates.payrollPeriods', 'must be a non-empty array');
  } else {
    let previousEffectiveTo = null;
    payload.payrollPeriods.forEach((period, index) => {
      const periodPath = `rates.payrollPeriods[${index}]`;
      validatePayrollPeriod(errors, period, periodPath);
      if (previousEffectiveTo && isIsoDate(period.effectiveFrom) && period.effectiveFrom <= previousEffectiveTo) {
        addError(errors, `${periodPath}.effectiveFrom`, 'must be after the previous period effectiveTo date');
      }
      if (isPlainObject(payload.annualTax) && isPlainObject(period)) {
        validateRatePeriod(errors, resolvePayrollPeriodRates(payload.annualTax, period), `${periodPath}.resolved`);
      }
      previousEffectiveTo = period.effectiveTo;
    });
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidRatesPayload(payload) {
  const validation = validateRatesPayload(payload);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }
  return payload;
}
