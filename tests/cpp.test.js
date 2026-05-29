import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCpp } from '../src/lib/cpp.js';
import { getBc2026RatesForDate } from '../src/rates/ca-bc-2026.js';

const rates = getBc2026RatesForDate('2026-01-01');

test('calculates incremental CPP below YMPE', () => {
  const result = calculateCpp({
    ytdPensionableEarnings: 10000,
    ytdEmployeeCpp: 386.75,
    ytdEmployeeCpp2: 0,
    currentGross: 5000,
    rates: rates.cpp
  });

  assert.equal(result.employeeCpp, 297.5);
  assert.equal(result.employerCpp, 297.5);
  assert.equal(result.employeeCpp2, 0);
});

test('caps CPP and calculates CPP2 when payment crosses YMPE', () => {
  const result = calculateCpp({
    ytdPensionableEarnings: 74000,
    ytdEmployeeCpp: 4194.75,
    ytdEmployeeCpp2: 0,
    currentGross: 3000,
    rates: rates.cpp
  });

  assert.equal(result.employeeCpp, 35.7);
  assert.equal(result.employeeCpp2, 96);
});

test('returns zero CPP when already maxed', () => {
  const result = calculateCpp({
    ytdPensionableEarnings: 86000,
    ytdEmployeeCpp: 4230.45,
    ytdEmployeeCpp2: 416,
    currentGross: 5000,
    rates: rates.cpp
  });

  assert.equal(result.totalEmployeeCpp, 0);
});
