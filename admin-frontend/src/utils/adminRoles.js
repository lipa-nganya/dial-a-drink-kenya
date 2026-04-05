/**
 * Super-admin-level features in the UI (aligns with backend requireSuperAdmin:
 * super_admin and super_super_admin).
 */
export function hasSuperAdminPrivileges(role) {
  return role === 'super_admin' || role === 'super_super_admin';
}

/**
 * User management section in Settings (admin, super_admin, super_super_admin).
 */
export function canManageAdminUsers(role) {
  return role === 'admin' || role === 'super_admin' || role === 'super_super_admin';
}
