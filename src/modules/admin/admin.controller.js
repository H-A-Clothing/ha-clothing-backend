// HTTP handlers for Member 8 admin endpoints.
import * as adminService from "./admin.service.js";
import {
  validateAssignStaff,
  validateCreateRole,
  validateUpdateProfile,
  validateUpdateRole,
} from "./admin.validation.js";
import { AppError } from "../../utils/errors.js";

export async function getRoles(req, res, next) {
  try {
    const roles = await adminService.listRoles();
    res.json({ data: roles });
  } catch (error) {
    next(error);
  }
}

export async function postRole(req, res, next) {
  try {
    const payload = validateCreateRole(req.body);
    const role = await adminService.createRole(payload);
    res.status(201).json({ data: role });
  } catch (error) {
    next(error);
  }
}

export async function patchRole(req, res, next) {
  try {
    const roleId = Number(req.params.id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      throw AppError.badRequest("Invalid role id");
    }
    const updates = validateUpdateRole(req.body);
    const role = await adminService.updateRole(roleId, updates);
    res.json({ data: role });
  } catch (error) {
    next(error);
  }
}

export async function getStaff(req, res, next) {
  try {
    const staff = await adminService.listStaff();
    res.json({ data: staff });
  } catch (error) {
    next(error);
  }
}

export async function postStaff(req, res, next) {
  try {
    const payload = validateAssignStaff(req.body);
    const profile = await adminService.assignStaffRole(payload);
    res.status(201).json({ data: profile });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req, res, next) {
  try {
    const profile = await adminService.getAdminProfile(req.user.id);
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
}

export async function patchProfile(req, res, next) {
  try {
    const updates = validateUpdateProfile(req.body);
    const profile = await adminService.updateAdminProfile(req.user.id, updates);
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
}
