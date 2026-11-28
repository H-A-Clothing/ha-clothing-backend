// Database queries for roles, staff profiles, and admin profile management.
import { query, withTransaction } from "../../config/database.js";

export async function findAllRoles() {
  const { rows } = await query(
    `SELECT id, name, description, permissions, created_at, updated_at
     FROM roles
     ORDER BY id ASC`,
  );
  return rows;
}

export async function findRoleById(id) {
  const { rows } = await query(
    `SELECT id, name, description, permissions, created_at, updated_at
     FROM roles
     WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

export async function findRoleByName(name) {
  const { rows } = await query(`SELECT id, name FROM roles WHERE name = $1`, [
    name,
  ]);
  return rows[0] || null;
}

export async function insertRole({ name, description, permissions }) {
  const { rows } = await query(
    `INSERT INTO roles (name, description, permissions)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, name, description, permissions, created_at, updated_at`,
    [name, description, JSON.stringify(permissions)],
  );
  return rows[0];
}

export async function updateRoleById(id, { description, permissions }) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(description);
  }
  if (permissions !== undefined) {
    fields.push(`permissions = $${idx++}::jsonb`);
    values.push(JSON.stringify(permissions));
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE roles
     SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, name, description, permissions, created_at, updated_at`,
    values,
  );
  return rows[0] || null;
}

export async function findAllStaff() {
  const { rows } = await query(
    `SELECT
       u.id AS user_id,
       u.email,
       u.first_name,
       u.last_name,
       u.phone,
       u.is_active AS user_active,
       r.id AS role_id,
       r.name AS role_name,
       sp.job_title,
       sp.department,
       sp.is_active AS staff_active,
       sp.last_login_at,
       sp.created_at
     FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     JOIN roles r ON r.id = u.role_id
     ORDER BY sp.created_at DESC`,
  );
  return rows;
}

export async function findUserById(userId) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId],
  );
  return rows[0] || null;
}

export async function upsertStaffAssignment({
  user_id,
  role_id,
  job_title,
  department,
  is_active,
}) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET role_id = $1, is_active = $2 WHERE id = $3`,
      [role_id, is_active, user_id],
    );

    const { rows } = await client.query(
      `INSERT INTO staff_profiles (user_id, job_title, department, is_active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         job_title = EXCLUDED.job_title,
         department = EXCLUDED.department,
         is_active = EXCLUDED.is_active
       RETURNING user_id, job_title, department, is_active, last_login_at, created_at, updated_at`,
      [user_id, job_title, department, is_active],
    );

    return rows[0];
  });
}

export async function findAdminProfileByUserId(userId) {
  const { rows } = await query(
    `SELECT
       u.id,
       u.email,
       u.first_name,
       u.last_name,
       u.phone,
       r.name AS role,
       r.permissions,
       sp.job_title,
       sp.department,
       sp.last_login_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN staff_profiles sp ON sp.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  return rows[0] || null;
}

export async function updateAdminProfileByUserId(userId, updates) {
  return withTransaction(async (client) => {
    const userFields = [];
    const userValues = [];
    let idx = 1;

    if (updates.first_name !== undefined) {
      userFields.push(`first_name = $${idx++}`);
      userValues.push(updates.first_name);
    }
    if (updates.last_name !== undefined) {
      userFields.push(`last_name = $${idx++}`);
      userValues.push(updates.last_name);
    }
    if (updates.phone !== undefined) {
      userFields.push(`phone = $${idx++}`);
      userValues.push(updates.phone);
    }

    if (userFields.length > 0) {
      userValues.push(userId);
      await client.query(
        `UPDATE users SET ${userFields.join(", ")} WHERE id = $${idx}`,
        userValues,
      );
    }

    if (updates.job_title !== undefined) {
      await client.query(
        `INSERT INTO staff_profiles (user_id, job_title)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET job_title = EXCLUDED.job_title`,
        [userId, updates.job_title],
      );
    }

    const { rows } = await client.query(
      `SELECT
         u.id,
         u.email,
         u.first_name,
         u.last_name,
         u.phone,
         r.name AS role,
         sp.job_title,
         sp.department
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    return rows[0];
  });
}
