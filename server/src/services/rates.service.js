import { getDatabase } from '../database/connection.js';

export function getGold() {
  return getDatabase()
    .prepare('SELECT * FROM gold_rates ORDER BY effective_date DESC, id DESC')
    .all();
}
export function getDiamond() {
  return getDatabase()
    .prepare('SELECT * FROM diamond_rates ORDER BY effective_date DESC, id DESC')
    .all();
}
export function getGemstone() {
  return getDatabase()
    .prepare('SELECT * FROM gemstone_rates ORDER BY effective_date DESC, id DESC')
    .all();
}
export function getMaking() {
  return getDatabase()
    .prepare('SELECT * FROM making_charges ORDER BY effective_date DESC, id DESC')
    .all();
}
