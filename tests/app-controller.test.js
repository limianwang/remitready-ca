import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

function methodBody(methodName) {
  const signatureIndex = appSource.indexOf(`  ${methodName}(`);
  assert.notEqual(signatureIndex, -1, `${methodName} method should exist`);

  const bodyStart = appSource.indexOf('{', signatureIndex);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const character = appSource[index];
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) {
      return appSource.slice(bodyStart + 1, index);
    }
  }

  throw new Error(`Could not parse ${methodName} body`);
}

test('resetting YTD from history does not recalculate the current payment result', () => {
  assert.doesNotMatch(methodBody('applyHistoryYtd'), /this\.calculate\(/);
});
