import vectors from '../../../shared/slug-canonical-vectors.json';
import { normalizeSlug } from './slugCanonical';

describe('normalizeSlug (aligned with backend)', () => {
  test.each(vectors.map((v) => [v.input, v.expected]))(
    '%s → %s',
    (input, expected) => {
      expect(normalizeSlug(input)).toBe(expected);
    }
  );
});
