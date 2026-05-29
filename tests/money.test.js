import test from 'node:test';
import assert from 'node:assert/strict';
import { ceilToIncrement, dollarsToCents, formatMoney, roundToCents } from '../src/lib/money.js';

test('dollarsToCents handles dollar strings exactly', () => {
  assert.equal(dollarsToCents('1234.56'), 123456);
  assert.equal(dollarsToCents(''), 0);
});

test('roundToCents uses standard half-up rounding', () => {
  assert.equal(roundToCents(10.004), 10);
  assert.equal(roundToCents(10.005), 10.01);
});

test('ceilToIncrement rounds up to selected dollar increment', () => {
  assert.equal(ceilToIncrement(101.01, 5), 105);
  assert.equal(ceilToIncrement(100, 5), 100);
});

test('formatMoney formats dollars', () => {
  assert.equal(formatMoney(1234.5), '$1,234.50');
});
