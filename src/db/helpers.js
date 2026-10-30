// Small helpers shared by migrations.

// Keeps `updated_at` current on every UPDATE. Needs the set_updated_at() function
// created in the first migration.
export function addUpdatedAtTrigger(knex, table) {
  return knex.raw(`
    CREATE TRIGGER ${table}_set_updated_at
    BEFORE UPDATE ON ${table}
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `);
}

// Money is always decimal(10,2), never float.
export function money(table, column) {
  return table.decimal(column, 10, 2);
}
