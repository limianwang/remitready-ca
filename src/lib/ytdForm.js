export const HISTORY_YTD_FIELDS = [
  'ytdPriorLumpSums',
  'ytdPensionableEarnings',
  'ytdEmployeeCpp',
  'ytdEmployeeCpp2',
  'ytdIncomeTaxWithheld'
];

export function getChangedHistoryYtdFields(form, historyYtd, candidateFields = HISTORY_YTD_FIELDS) {
  return candidateFields.filter((field) => String(form[field]) !== String(historyYtd[field]));
}

export function applyHistoryYtdToForm(form, historyYtd, fields = HISTORY_YTD_FIELDS) {
  for (const field of fields) {
    form[field] = String(historyYtd[field]);
  }
}
