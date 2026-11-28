// Role-based access control (RBAC) middleware.
// Owner: Member 8. Used across all admin routes.
import { AppError } from "../utils/errors.js";
import { query } from "../config/database.js";

export const ADMIN_ROLES = [
  "admin",
  "staff",
  "inventory_manager",
  "finance_manager",
  "order_manager",
];

/**
 * Ensures the authenticated user holds one of the allowed roles.
 * Expects Member 3's auth middleware to populate `req.user`.
 */
export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized("Authentication required"));
      }

      let roleName = req.user.role;

      // Resolve role name from database if auth middleware only attached role_id.
      if (!roleName && req.user.role_id) {
        const { rows } = await query(
          "SELECT name, permissions FROM roles WHERE id = $1",
          [req.user.role_id],
        );
        if (rows[0]) {
          roleName = rows[0].name;
          req.user.role = rows[0].name;
          req.user.permissions = rows[0].permissions;
        }
      }

      if (!roleName || !allowedRoles.includes(roleName)) {
        return next(
          AppError.forbidden(
            "You do not have permission to perform this action",
          ),
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Checks whether the authenticated user's role grants a specific permission string.
 * Full `admin` role (`*`) bypasses granular permission checks.
 */
export function requirePermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized("Authentication required"));
      }

      if (req.user.role === "admin") {
        return next();
      }

      let permissions = req.user.permissions;

      if (!Array.isArray(permissions) && (req.user.role || req.user.role_id)) {
        const { rows } = req.user.role_id
          ? await query("SELECT name, permissions FROM roles WHERE id = $1", [
              req.user.role_id,
            ])
          : await query("SELECT name, permissions FROM roles WHERE name = $1", [
              req.user.role,
            ]);

        if (rows[0]) {
          req.user.role = rows[0].name;
          permissions = rows[0].permissions || [];
          req.user.permissions = permissions;
        }
      }

      if (
        Array.isArray(permissions) &&
        (permissions.includes("*") || permissions.includes(requiredPermission))
      ) {
        return next();
      }

      return next(
        AppError.forbidden(
          `Missing required permission: ${requiredPermission}`,
        ),
      );
    } catch (error) {
      return next(error);
    }
  };
}

export const requireAdmin = requireRole(...ADMIN_ROLES);
