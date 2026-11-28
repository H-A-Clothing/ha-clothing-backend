// Business logic for roles, staff management, and admin profiles.
import * as adminRepo from "./admin.repository.js";
import { AppError } from "../../utils/errors.js";

const SYSTEM_PROTECTED_ROLES = ["customer", "admin"];

export async function listRoles() {
  return adminRepo.findAllRoles();
}

export async function createRole(payload) {
  const existing = await adminRepo.findRoleByName(payload.name);
  if (existing) {
    throw AppError.conflict(`Role '${payload.name}' already exists`);
  }
  return adminRepo.insertRole(payload);
}

export async function updateRole(roleId, updates) {
  const role = await adminRepo.findRoleById(roleId);
  if (!role) {
    throw AppError.notFound("Role not found");
  }
  if (SYSTEM_PROTECTED_ROLES.includes(role.name) && updates.permissions) {
    throw AppError.badRequest(
      `Permissions on core role '${role.name}' cannot be modified`,
    );
  }
  return adminRepo.updateRoleById(roleId, updates);
}

export async function listStaff() {
  return adminRepo.findAllStaff();
}

export async function assignStaffRole(payload) {
  const user = await adminRepo.findUserById(payload.user_id);
  if (!user) {
    throw AppError.notFound("User not found");
  }

  const role = await adminRepo.findRoleById(payload.role_id);
  if (!role) {
    throw AppError.notFound("Role not found");
  }

  if (role.name === "customer") {
    throw AppError.badRequest("Cannot assign customer role as a staff profile");
  }

  return adminRepo.upsertStaffAssignment(payload);
}

export async function getAdminProfile(userId) {
  const profile = await adminRepo.findAdminProfileByUserId(userId);
  if (!profile) {
    throw AppError.notFound("Admin profile not found");
  }
  return profile;
}

export async function updateAdminProfile(userId, updates) {
  const existing = await adminRepo.findAdminProfileByUserId(userId);
  if (!existing) {
    throw AppError.notFound("Admin profile not found");
  }
  return adminRepo.updateAdminProfileByUserId(userId, updates);
}
