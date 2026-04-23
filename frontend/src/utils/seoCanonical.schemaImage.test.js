import { buildProductSchemaImageList } from './seoCanonical';

describe('buildProductSchemaImageList', () => {
  const origin = 'https://dialadrinkkenya.com';

  test('uses HTTPS placeholder for empty and data URIs', () => {
    expect(buildProductSchemaImageList({ resolvedUrl: '', canonicalOrigin: origin })).toEqual([
      `${origin}/assets/images/drinks/placeholder.svg`
    ]);
    expect(
      buildProductSchemaImageList({
        resolvedUrl: 'data:image/png;base64,xxx',
        canonicalOrigin: origin
      })
    ).toEqual([`${origin}/assets/images/drinks/placeholder.svg`]);
  });

  test('upgrades http to https', () => {
    const out = buildProductSchemaImageList({
      resolvedUrl: 'http://example.com/a.jpg',
      canonicalOrigin: origin
    });
    expect(out).toEqual(['https://example.com/a.jpg']);
  });

  test('accepts https backend image URL', () => {
    const u = 'https://deliveryos-production-backend-805803410802.us-central1.run.app/public/foo.jpg';
    expect(buildProductSchemaImageList({ resolvedUrl: u, canonicalOrigin: origin })).toEqual([u]);
  });
});
