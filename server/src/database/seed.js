import 'dotenv/config';
import { initDatabase, getDatabase, closeDatabase } from './connection.js';

initDatabase();
const db = getDatabase();

const goldRates = [
  { purity: '24Kt', rate_per_gram: 7800 },
  { purity: '22Kt', rate_per_gram: 7150 },
  { purity: '18Kt', rate_per_gram: 5850 },
  { purity: '14Kt', rate_per_gram: 4550 }
];

const diamondRates = [
  { shape: 'Round',    clarity: 'VS1',  color: 'F', rate_per_carat: 85000 },
  { shape: 'Princess', clarity: 'VS1',  color: 'F', rate_per_carat: 72000 },
  { shape: 'Oval',     clarity: 'VVS1', color: 'E', rate_per_carat: 92000 },
  { shape: 'Emerald',  clarity: 'VS2',  color: 'G', rate_per_carat: 68000 }
];

const gemstoneRates = [
  { gemstone: 'Ruby',     grade: 'AAA', rate_per_carat: 45000 },
  { gemstone: 'Emerald',  grade: 'AAA', rate_per_carat: 38000 },
  { gemstone: 'Sapphire', grade: 'AAA', rate_per_carat: 32000 },
  { gemstone: 'Pearl',    grade: 'A',   rate_per_carat: 1200  }
];

const makingCharges = [
  { category: 'Ring',     charge_type: 'per_gram',   charge_value: 1200 },
  { category: 'Necklace', charge_type: 'per_gram',   charge_value: 950  },
  { category: 'Bangle',   charge_type: 'per_gram',   charge_value: 850  },
  { category: 'Earring',  charge_type: 'per_gram',   charge_value: 1100 },
  { category: 'Pendant',  charge_type: 'fixed',      charge_value: 2500 }
];

const insertGold = db.prepare(
  'INSERT INTO gold_rates (purity, rate_per_gram) VALUES (?, ?)'
);
const insertDiamond = db.prepare(
  'INSERT INTO diamond_rates (shape, clarity, color, rate_per_carat) VALUES (?, ?, ?, ?)'
);
const insertGemstone = db.prepare(
  'INSERT INTO gemstone_rates (gemstone, grade, rate_per_carat) VALUES (?, ?, ?)'
);
const insertMaking = db.prepare(
  'INSERT INTO making_charges (category, charge_type, charge_value) VALUES (?, ?, ?)'
);

const seed = db.transaction(() => {
  for (const r of goldRates)     insertGold.run(r.purity, r.rate_per_gram);
  for (const r of diamondRates)  insertDiamond.run(r.shape, r.clarity, r.color, r.rate_per_carat);
  for (const r of gemstoneRates) insertGemstone.run(r.gemstone, r.grade, r.rate_per_carat);
  for (const r of makingCharges) insertMaking.run(r.category, r.charge_type, r.charge_value);
});

seed();
console.log('[JBOS] Seed data inserted.');
closeDatabase();
