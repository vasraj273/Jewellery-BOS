import { getDb } from '../database/connection.js';

export async function getGold() {
  const sql = getDb();
  return sql`SELECT * FROM gold_rates ORDER BY effective_date DESC, id DESC`;
}
export async function getDiamond() {
  const sql = getDb();
  return sql`SELECT * FROM diamond_rates ORDER BY effective_date DESC, id DESC`;
}
export async function getGemstone() {
  const sql = getDb();
  return sql`SELECT * FROM gemstone_rates ORDER BY effective_date DESC, id DESC`;
}
export async function getMaking() {
  const sql = getDb();
  return sql`SELECT * FROM making_charges ORDER BY effective_date DESC, id DESC`;
}
