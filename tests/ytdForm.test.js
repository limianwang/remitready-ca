import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHistoryYtdToForm,
  getChangedHistoryYtdFields
} from '../src/lib/ytdForm.js';

test('detects touched YTD fields that differ from history values', () => {
  const form = {
    ytdPriorLumpSums: '99999',
    ytdPensionableEarnings: '10000',
    ytdEmployeeCpp: '595',
    ytdEmployeeCpp2: '0',
    ytdIncomeTaxWithheld: '2000'
  };
  const historyYtd = {
    ytdPriorLumpSums: 10000,
    ytdPensionableEarnings: 10000,
    ytdEmployeeCpp: 595,
    ytdEmployeeCpp2: 0,
    ytdIncomeTaxWithheld: 2000
  };

  assert.deepEqual(
    getChangedHistoryYtdFields(form, historyYtd, ['ytdPriorLumpSums', 'ytdEmployeeCpp']),
    ['ytdPriorLumpSums']
  );
});

test('rehydrates only the requested touched YTD fields', () => {
  const form = {
    ytdPriorLumpSums: '99999',
    ytdPensionableEarnings: '77777',
    ytdEmployeeCpp: '595',
    ytdEmployeeCpp2: '0',
    ytdIncomeTaxWithheld: '2000'
  };
  const historyYtd = {
    ytdPriorLumpSums: 10000,
    ytdPensionableEarnings: 10000,
    ytdEmployeeCpp: 595,
    ytdEmployeeCpp2: 0,
    ytdIncomeTaxWithheld: 2000
  };

  applyHistoryYtdToForm(form, historyYtd, ['ytdPriorLumpSums']);

  assert.equal(form.ytdPriorLumpSums, '10000');
  assert.equal(form.ytdPensionableEarnings, '77777');
});
