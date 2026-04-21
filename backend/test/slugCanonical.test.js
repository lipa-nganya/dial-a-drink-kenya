'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../shared/slug-canonical-vectors.json'), 'utf8')
);
const { normalizeSlug } = require('../utils/slugCanonical');

for (const { input, expected } of vectors) {
  test(`normalizeSlug(${JSON.stringify(input)})`, () => {
    assert.strictEqual(normalizeSlug(input), expected);
  });
}
