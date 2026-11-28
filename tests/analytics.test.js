import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

const { validateAnalyticsQuery } =
  await import("../src/modules/analytics/analytics.validation.js");
const { formatSalesTrendToCsv } =
  await import("../src/modules/analytics/analytics.service.js");
const { requireAdmin } = await import("../src/middleware/role.middleware.js");

test("Analytics validation: accepts valid date range and limit", () => {
  const result = validateAnalyticsQuery({
    from: "2026-11-01",
    to: "2026-11-28",
    limit: "10",
  });
  assert.deepEqual(result, { from: "2026-11-01", to: "2026-11-28", limit: 10 });
});

test("Analytics validation: rejects invalid dates or reversed date range", () => {
  assert.throws(
    () => validateAnalyticsQuery({ from: "not-a-date", to: "2026-11-28" }),
    {
      status: 400,
    },
  );
  assert.throws(
    () => validateAnalyticsQuery({ from: "2026-11-28", to: "2026-11-01" }),
    {
      status: 400,
    },
  );
});

test("Analytics CSV formatter: produces valid CSV rows", () => {
  const csv = formatSalesTrendToCsv([
    { date: "2026-11-27", orders: 4, revenue: "18500.00" },
    { date: "2026-11-28", orders: 6, revenue: "27400.00" },
  ]);
  assert.equal(
    csv,
    "Date,Completed Orders,Revenue\n2026-11-27,4,18500.00\n2026-11-28,6,27400.00",
  );
});

test("Analytics RBAC: blocks customer role from accessing analytics endpoints", async () => {
  const err = await new Promise((resolve) => {
    requireAdmin({ user: { id: 99, role: "customer" } }, {}, (e) =>
      resolve(e || null),
    );
  });
  assert.ok(err);
  assert.equal(err.status, 403);
});
