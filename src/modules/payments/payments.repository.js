// Shared payment SQL queries (payments, payment_events, and the order fields payments need).
// Every function takes `db`: the pool for single reads, or the client given by withTransaction().

const PAYMENT_COLUMNS = `
  p.id, p.reference, p.order_id, p.provider, p.status, p.idempotency_key, p.provider_payment_id,
  p.amount, p.currency, p.card_brand, p.card_last4, p.failure_reason, p.paid_at`;

// Locks the order row, so two payment requests for the same order run one after the other.
export async function findOrderForUpdate(db, orderNumber) {
  const { rows } = await db.query(
    `SELECT id, order_number, status, total, currency, customer_email
     FROM orders WHERE order_number = $1 FOR UPDATE`,
    [orderNumber]
  );
  return rows[0] ?? null;
}

export async function lockOrderById(db, orderId) {
  const { rows } = await db.query("SELECT id, status FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
  return rows[0] ?? null;
}

export async function findPaymentByIdempotencyKey(db, idempotencyKey) {
  const { rows } = await db.query(`SELECT ${PAYMENT_COLUMNS} FROM payments p WHERE p.idempotency_key = $1`, [
    idempotencyKey,
  ]);
  return rows[0] ?? null;
}

export async function findPaymentByReference(db, reference, { forUpdate = false } = {}) {
  const { rows } = await db.query(
    `SELECT ${PAYMENT_COLUMNS}, o.order_number
     FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE p.reference = $1 ${forUpdate ? "FOR UPDATE OF p" : ""}`,
    [reference]
  );
  return rows[0] ?? null;
}

export async function hasSucceededPayment(db, orderId) {
  const { rows } = await db.query(
    "SELECT 1 FROM payments WHERE order_id = $1 AND status = 'succeeded' LIMIT 1",
    [orderId]
  );
  return rows.length > 0;
}

// Other attempts for the same order that could still be paid (e.g. a second browser tab).
export async function findOtherPendingPayments(db, orderId, paymentId) {
  const { rows } = await db.query(
    `SELECT ${PAYMENT_COLUMNS} FROM payments p
     WHERE p.order_id = $1 AND p.id <> $2 AND p.status = 'pending'`,
    [orderId, paymentId]
  );
  return rows;
}

export async function insertPayment(db, { reference, orderId, provider, idempotencyKey, amount, currency }) {
  const { rows } = await db.query(
    `INSERT INTO payments AS p (reference, order_id, provider, idempotency_key, amount, currency)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${PAYMENT_COLUMNS}`,
    [reference, orderId, provider, idempotencyKey, amount, currency]
  );
  return rows[0];
}

// Only the fields that are passed (not undefined) are changed.
export async function updatePayment(db, id, fields) {
  const columns = {
    status: fields.status,
    provider_payment_id: fields.providerPaymentId,
    card_brand: fields.cardBrand,
    card_last4: fields.cardLast4,
    failure_reason: fields.failureReason,
    provider_fee: fields.providerFee,
    refunded_amount: fields.refundedAmount,
    paid_at: fields.paidAt,
  };
  const entries = Object.entries(columns).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const sets = entries.map(([column], index) => `${column} = $${index + 2}`).join(", ");
  await db.query(`UPDATE payments SET ${sets} WHERE id = $1`, [id, ...entries.map(([, value]) => value)]);
}

export async function markOrderPaid(db, orderId) {
  await db.query("UPDATE orders SET status = 'paid' WHERE id = $1 AND status = 'pending_payment'", [orderId]);
}

// Returns the new event id, or null when this provider event was already stored (a repeated callback).
export async function insertEvent(db, { paymentId, provider, providerEventId, eventType, signatureValid, payload }) {
  const { rows } = await db.query(
    `INSERT INTO payment_events (payment_id, provider, provider_event_id, event_type, signature_valid, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (provider, provider_event_id) DO NOTHING
     RETURNING id`,
    [paymentId, provider, providerEventId, eventType, signatureValid, payload]
  );
  return rows[0]?.id ?? null;
}

export async function markEventProcessed(db, eventId) {
  await db.query("UPDATE payment_events SET processed_at = now() WHERE id = $1", [eventId]);
}

export async function findOrderDetails(db, orderId) {
  const { rows } = await db.query(
    `SELECT id, order_number, status, customer_email, delivery_method,
            shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_district,
            shipping_postal_code, shipping_country,
            subtotal, discount_code, discount_amount, shipping_fee, tax_amount, total, currency, placed_at
     FROM orders WHERE id = $1`,
    [orderId]
  );
  return rows[0] ?? null;
}

export async function findOrderItems(db, orderId) {
  const { rows } = await db.query(
    `SELECT oi.id, oi.product_name, oi.color, oi.size, oi.quantity, oi.unit_price, c.name AS category_name
     FROM order_items oi
     LEFT JOIN products pr ON pr.id = oi.product_id
     LEFT JOIN categories c ON c.id = pr.category_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [orderId]
  );
  return rows;
}
