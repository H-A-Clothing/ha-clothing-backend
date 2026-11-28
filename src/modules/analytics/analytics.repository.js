// Read-only SQL analytics queries across orders, order_items, products, and users.
import { query } from "../../config/database.js";

const REVENUE_STATUSES = ["paid", "processing", "dispatched", "delivered"];

export async function getOverviewMetrics({ from, to }) {
  const { rows: orderRows } = await query(
    `SELECT
       COUNT(*)::int AS total_orders,
       COUNT(*) FILTER (WHERE status = ANY($3))::int AS completed_orders,
       COUNT(*) FILTER (WHERE status IN ('cancelled', 'refunded'))::int AS cancelled_orders,
       COALESCE(SUM(total) FILTER (WHERE status = ANY($3)), 0)::numeric(12,2) AS total_revenue,
       COALESCE(AVG(total) FILTER (WHERE status = ANY($3)), 0)::numeric(12,2) AS average_order_value
     FROM orders
     WHERE placed_at >= $1::date
       AND placed_at < ($2::date + INTERVAL '1 day')`,
    [from, to, REVENUE_STATUSES],
  );

  const { rows: userRows } = await query(
    `SELECT
       COUNT(*)::int AS total_customers,
       COUNT(*) FILTER (
         WHERE u.created_at >= $1::date AND u.created_at < ($2::date + INTERVAL '1 day')
       )::int AS new_customers
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'customer'`,
    [from, to],
  );

  const { rows: productRows } = await query(
    `SELECT COUNT(*)::int AS active_products FROM products WHERE is_active = true`,
  );

  return {
    ...orderRows[0],
    ...userRows[0],
    active_products: productRows[0]?.active_products ?? 0,
  };
}

export async function getSalesTrend({ from, to }) {
  const { rows } = await query(
    `SELECT
       TO_CHAR(DATE(placed_at), 'YYYY-MM-DD') AS date,
       COUNT(*)::int AS orders,
       COALESCE(SUM(total), 0)::numeric(12,2) AS revenue
     FROM orders
     WHERE status = ANY($3)
       AND placed_at >= $1::date
       AND placed_at < ($2::date + INTERVAL '1 day')
     GROUP BY DATE(placed_at)
     ORDER BY DATE(placed_at) ASC`,
    [from, to, REVENUE_STATUSES],
  );
  return rows;
}

export async function getOrderStatusBreakdown({ from, to }) {
  const { rows } = await query(
    `SELECT
       status,
       COUNT(*)::int AS count,
       COALESCE(SUM(total), 0)::numeric(12,2) AS total_amount
     FROM orders
     WHERE placed_at >= $1::date
       AND placed_at < ($2::date + INTERVAL '1 day')
     GROUP BY status
     ORDER BY count DESC`,
    [from, to],
  );
  return rows;
}

export async function getTopProducts({ from, to, limit }) {
  const { rows } = await query(
    `SELECT
       oi.product_id,
       oi.product_name,
       COALESCE(c.name, 'Uncategorized') AS category_name,
       SUM(oi.quantity)::int AS units_sold,
       COALESCE(SUM(oi.line_total), 0)::numeric(12,2) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE o.status = ANY($3)
       AND o.placed_at >= $1::date
       AND o.placed_at < ($2::date + INTERVAL '1 day')
     GROUP BY oi.product_id, oi.product_name, c.name
     ORDER BY units_sold DESC, revenue DESC
     LIMIT $4`,
    [from, to, REVENUE_STATUSES, limit],
  );
  return rows;
}

export async function getCategorySales({ from, to }) {
  const { rows } = await query(
    `SELECT
       COALESCE(c.name, 'Uncategorized') AS category_name,
       SUM(oi.quantity)::int AS units_sold,
       COALESCE(SUM(oi.line_total), 0)::numeric(12,2) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE o.status = ANY($3)
       AND o.placed_at >= $1::date
       AND o.placed_at < ($2::date + INTERVAL '1 day')
     GROUP BY c.name
     ORDER BY revenue DESC`,
    [from, to, REVENUE_STATUSES],
  );
  return rows;
}
