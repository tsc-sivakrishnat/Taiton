import { pool } from '../config/db.js';
import { queries } from '../db/queries.js';
import { normalizeRoleCode, roleMatchesNavCsv } from '../utils/roleCsv.js';

export async function listNavForOrgAndRole({ organizationId, roleCode }) {
  const [rows] = await pool.query(queries.navigationForOrg, {
    organizationId,
  });
  const role = normalizeRoleCode(roleCode);

  return rows
    .filter((r) => roleMatchesNavCsv(role, r.roles_csv))
    .filter((r) => String(r.route ?? '').trim() !== '/app/notifications')
    .map((r) => ({
      id: r.id,
      label: r.label,
      icon: r.icon,
      route: r.route,
      position: r.position,
      sortOrder: r.sort_order,
      rolesCsv: r.roles_csv ?? null,
    }));
}
