/** Match backend contentType → approval rule resource key. */
export function contentTypeToResource(contentType) {
  const map = {
    product: 'products',
    seo: 'seo',
    ui_element: 'ui_elements',
  };
  return map[String(contentType ?? '').trim()] ?? String(contentType ?? '').trim();
}

/** Show approve/reject only when this user is the checker for that submission. */
export function canApprovePendingItem({ rules, resource, createdByRole, roleCode }) {
  const checker = String(roleCode ?? '').trim();
  const maker = String(createdByRole ?? '').trim();
  const res = String(resource ?? '').trim();
  if (!checker || !maker || !res) return false;

  const rule = (rules ?? []).find(
    (r) =>
      r.resource === res &&
      r.makerRole === maker &&
      r.isActive !== false &&
      r.isActive !== 0,
  );
  if (!rule) return false;
  return rule.checkerRole === checker;
}
