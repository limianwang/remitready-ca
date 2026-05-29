import { validateHistoryPayload } from './history.js';

export function exportHistoryJson(records, exportedAt = new Date().toISOString()) {
  const payload = { version: 1, exportedAt, records };
  const validation = validateHistoryPayload(payload);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }
  return JSON.stringify(payload, null, 2);
}

export function importHistoryJson(jsonText) {
  const payload = JSON.parse(jsonText);
  const validation = validateHistoryPayload(payload);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }
  return payload.records;
}

export function getHistoryExportFilename(taxYear, exportedAt = new Date().toISOString()) {
  const date = exportedAt.slice(0, 10);
  return `remitready-ca-history-${taxYear}-${date}.json`;
}
