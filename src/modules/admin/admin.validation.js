// Request validation for Member 8 admin endpoints (roles, staff, admin profile).
import { AppError } from "../../utils/errors.js";

export function validateCreateRole(body) {
  const errors = [];
  const name =
    typeof body?.name === "string" ? body.name.trim().toLowerCase() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : null;
  const permissions = body?.permissions ?? [];

  if (
    !name ||
    name.length < 2 ||
    name.length > 50 ||
    !/^[a-z0-9_-]+$/.test(name)
  ) {
    errors.push({
      field: "name",
      message:
        "Role name must be 2-50 lowercase letters, numbers, underscores, or hyphens",
    });
  }

  if (
    !Array.isArray(permissions) ||
    permissions.some((p) => typeof p !== "string")
  ) {
    errors.push({
      field: "permissions",
      message: "Permissions must be an array of strings",
    });
  }

  if (errors.length > 0) {
    throw AppError.badRequest("Invalid role payload", errors);
  }

  return { name, description, permissions };
}

export function validateUpdateRole(body) {
  const errors = [];
  const updates = {};

  if (body?.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 255) {
      errors.push({
        field: "description",
        message: "Description must be at most 255 characters",
      });
    } else {
      updates.description = body.description.trim();
    }
  }

  if (body?.permissions !== undefined) {
    if (
      !Array.isArray(body.permissions) ||
      body.permissions.some((p) => typeof p !== "string")
    ) {
      errors.push({
        field: "permissions",
        message: "Permissions must be an array of strings",
      });
    } else {
      updates.permissions = body.permissions;
    }
  }

  if (Object.keys(updates).length === 0 && errors.length === 0) {
    errors.push({
      field: "body",
      message: "At least one updatable field is required",
    });
  }

  if (errors.length > 0) {
    throw AppError.badRequest("Invalid role update payload", errors);
  }

  return updates;
}

export function validateAssignStaff(body) {
  const errors = [];
  const userId = Number(body?.user_id);
  const roleId = Number(body?.role_id);
  const jobTitle =
    typeof body?.job_title === "string" ? body.job_title.trim() : "";
  const department =
    typeof body?.department === "string" ? body.department.trim() : null;
  const isActive =
    body?.is_active === undefined ? true : Boolean(body.is_active);

  if (!Number.isInteger(userId) || userId <= 0) {
    errors.push({ field: "user_id", message: "Valid user_id is required" });
  }

  if (!Number.isInteger(roleId) || roleId <= 0) {
    errors.push({ field: "role_id", message: "Valid role_id is required" });
  }

  if (!jobTitle || jobTitle.length < 2 || jobTitle.length > 100) {
    errors.push({
      field: "job_title",
      message: "Job title must be 2-100 characters",
    });
  }

  if (errors.length > 0) {
    throw AppError.badRequest("Invalid staff assignment payload", errors);
  }

  return {
    user_id: userId,
    role_id: roleId,
    job_title: jobTitle,
    department,
    is_active: isActive,
  };
}

export function validateUpdateProfile(body) {
  const errors = [];
  const updates = {};

  if (body?.first_name !== undefined) {
    if (
      typeof body.first_name !== "string" ||
      body.first_name.trim().length < 1
    ) {
      errors.push({
        field: "first_name",
        message: "First name cannot be empty",
      });
    } else {
      updates.first_name = body.first_name.trim();
    }
  }

  if (body?.last_name !== undefined) {
    if (
      typeof body.last_name !== "string" ||
      body.last_name.trim().length < 1
    ) {
      errors.push({ field: "last_name", message: "Last name cannot be empty" });
    } else {
      updates.last_name = body.last_name.trim();
    }
  }

  if (body?.phone !== undefined) {
    if (body.phone !== null && typeof body.phone !== "string") {
      errors.push({ field: "phone", message: "Phone must be a valid string" });
    } else {
      updates.phone = body.phone ? body.phone.trim() : null;
    }
  }

  if (body?.job_title !== undefined) {
    if (
      typeof body.job_title !== "string" ||
      body.job_title.trim().length < 2
    ) {
      errors.push({
        field: "job_title",
        message: "Job title must be at least 2 characters",
      });
    } else {
      updates.job_title = body.job_title.trim();
    }
  }

  if (errors.length > 0) {
    throw AppError.badRequest("Invalid profile update payload", errors);
  }

  return updates;
}
