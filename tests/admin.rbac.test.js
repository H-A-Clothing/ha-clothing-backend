import test from "node:test";
import assert from "node:assert/strict";

// Provide a fallback DATABASE_URL for CI environments where .env is not present.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

const { requireAdmin, requirePermission, requireRole } =
  await import("../src/middleware/role.middleware.js");
const { validateAssignStaff, validateCreateRole } =
  await import("../src/modules/admin/admin.validation.js");

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err || null));
  });
}

test("RBAC: denies unauthenticated requests with 401", async () => {
  const err = await runMiddleware(requireRole("admin"), {});
  assert.ok(err);
  assert.equal(err.status, 401);
});

test("RBAC: denies customer role from accessing admin endpoints with 403", async () => {
  const err = await runMiddleware(requireAdmin, {
    user: { id: 10, role: "customer" },
  });
  assert.ok(err);
  assert.equal(err.status, 403);
});

test("RBAC: allows admin and finer staff roles on requireAdmin", async () => {
  const adminErr = await runMiddleware(requireAdmin, {
    user: { id: 1, role: "admin" },
  });
  assert.equal(adminErr, null);

  const staffErr = await runMiddleware(requireAdmin, {
    user: { id: 2, role: "inventory_manager" },
  });
  assert.equal(staffErr, null);
});

test("RBAC: enforces granular permissions for non-admin staff", async () => {
  const middleware = requirePermission("inventory:manage");

  const deniedErr = await runMiddleware(middleware, {
    user: { id: 3, role: "finance_manager", permissions: ["finance:manage"] },
  });
  assert.ok(deniedErr);
  assert.equal(deniedErr.status, 403);

  const allowedErr = await runMiddleware(middleware, {
    user: {
      id: 4,
      role: "inventory_manager",
      permissions: ["inventory:manage"],
    },
  });
  assert.equal(allowedErr, null);
});

test("Validation: validates role creation and staff assignment payloads", () => {
  const validRole = validateCreateRole({
    name: "content_editor",
    description: "Edits FAQs and policies",
    permissions: ["faqs:manage"],
  });
  assert.equal(validRole.name, "content_editor");

  assert.throws(() => validateCreateRole({ name: "Invalid Role!" }), {
    status: 400,
  });
  assert.throws(
    () => validateAssignStaff({ user_id: -1, role_id: 2, job_title: "" }),
    {
      status: 400,
    },
  );
});
