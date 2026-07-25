/** Match backend contentType → approval rule resource key. */
export function contentTypeToResource(contentType) {
  const map = {
    product: 'products',
    category: 'products',
    subcategory: 'products',
    variant: 'products',
    seo: 'seo',
    ui_element: 'ui_elements',
    blog: 'blogs',
    career: 'careers',
  };
  return map[String(contentType ?? '').trim()] ?? String(contentType ?? '').trim();
}

/** Show approve/reject only when this user is the checker for that submission. */
export function canApprovePendingItem({ rules, resource, createdByRole, roleCode }) {
  const checker = String(roleCode ?? '').trim();
  const maker = String(createdByRole ?? '').trim();
  const res = String(resource ?? '').trim();
  if (!checker || !maker || !res) return false;

  const RESOURCE_TO_ROUTES = {
    'products': ['products', '/app/products'],
    'seo': ['seo', '/app/seo'],
    'ui_elements': ['ui_elements', '/app/ui-elements', '/app/ui-element'],
    'blogs': ['blogs', '/app/blog', '/app/blogs'],
  };
  const allowed = RESOURCE_TO_ROUTES[res] || [res];

  const rule = (rules ?? []).find(
    (r) =>
      allowed.includes(r.resource) &&
      r.makerRole === maker &&
      r.isActive !== false &&
      r.isActive !== 0,
  );
  if (!rule) return false;
  return rule.checkerRole === checker;
}
