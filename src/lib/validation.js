export function validateInputs(input, rates) {
  const errors = [];
  const moneyFields = [
    'ytdRegularPay',
    'ytdPriorLumpSums',
    'ytdPensionableEarnings',
    'ytdEmployeeCpp',
    'ytdEmployeeCpp2',
    'ytdIncomeTaxWithheld',
    'currentGross'
  ];

  for (const field of moneyFields) {
    if (!Number.isFinite(input[field])) {
      errors.push({ field, message: 'Enter a valid dollar amount.' });
    } else if (input[field] < 0) {
      errors.push({ field, message: 'Amount cannot be negative.' });
    }
  }

  if (input.currentGross === 0) {
    errors.push({ field: 'currentGross', message: 'Current lump-sum gross must be greater than zero.' });
  }

  if (input.ytdEmployeeCpp > rates.cpp.maxCpp + 0.01) {
    errors.push({ field: 'ytdEmployeeCpp', message: 'YTD employee CPP exceeds the 2026 CPP maximum.' });
  }

  if (input.ytdEmployeeCpp2 > rates.cpp.maxCpp2 + 0.01) {
    errors.push({ field: 'ytdEmployeeCpp2', message: 'YTD employee CPP2 exceeds the 2026 CPP2 maximum.' });
  }

  return errors;
}
