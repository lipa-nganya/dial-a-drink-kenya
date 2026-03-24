export const toBrandSlug = (value = '') =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildBrandPath = (brand) => {
  const slug = toBrandSlug(brand?.name || '');
  if (slug) {
    return `/brands/${slug}`;
  }
  return `/brands/${brand?.id}`;
};
