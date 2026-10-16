// Store database — tabel terpisah dari API utama (prefix store_)
// Dipakai oleh backend toko Habibi Store di /store/*

import db from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS store_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    whatsapp TEXT,
    product_name TEXT NOT NULL,
    panel_username TEXT,
    payment_method TEXT NOT NULL,
    voucher_code TEXT,
    subtotal INTEGER NOT NULL,
    discount INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    status TEXT DEFAULT 'menunggu_pembayaran'
      CHECK (status IN ('menunggu_pembayaran','diproses','selesai','dibatalkan')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_store_orders_invoice ON store_orders(invoice_number);
  CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(status);
  CREATE INDEX IF NOT EXISTS idx_store_orders_created ON store_orders(created_at DESC);

  CREATE TABLE IF NOT EXISTS store_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS store_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// Default settings & vouchers (hanya isi kalau kosong)
const hasSettings = db.prepare('SELECT COUNT(*) c FROM store_settings').get().c
if (!hasSettings) {
  const ins = db.prepare('INSERT INTO store_settings (key, value) VALUES (?, ?)')
  ins.run('whatsapp_number', '6285181576338')
  ins.run('store_name', 'Habibi Store')
  ins.run('checkout_greeting', 'Halo Habibi Store, saya ingin konfirmasi pesanan.')
}

const hasVouchers = db.prepare('SELECT COUNT(*) c FROM store_vouchers').get().c
if (!hasVouchers) {
  const ins = db.prepare('INSERT INTO store_vouchers (code, discount_percent) VALUES (?, ?)')
  ins.run('HEMAT10', 10)
  ins.run('PANEL20', 20)
  ins.run('NEWBIE5', 5)
}

export function createOrder(data) {
  const invoice =
    'HBS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') +
    '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
  const stmt = db.prepare(`
    INSERT INTO store_orders
      (invoice_number, customer_name, whatsapp, product_name, panel_username,
       payment_method, voucher_code, subtotal, discount, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    invoice, data.customer_name || null, data.whatsapp || null,
    data.product_name, data.panel_username || null, data.payment_method,
    data.voucher_code || null, data.subtotal, data.discount || 0, data.total
  )
  // tambah used_count voucher
  if (data.voucher_code) {
    db.prepare('UPDATE store_vouchers SET used_count = used_count + 1 WHERE code = ?')
      .run(data.voucher_code.toUpperCase())
  }
  return getOrder(invoice)
}

export function getOrder(invoice) {
  return db.prepare('SELECT * FROM store_orders WHERE invoice_number = ?')
    .get(String(invoice).toUpperCase().trim())
}

export function listOrders(status, limit = 50) {
  if (status) {
    return db.prepare('SELECT * FROM store_orders WHERE status = ? ORDER BY created_at DESC LIMIT ?')
      .all(status, limit)
  }
  return db.prepare('SELECT * FROM store_orders ORDER BY created_at DESC LIMIT ?').all(limit)
}

export function updateOrderStatus(invoice, status) {
  const allowed = ['menunggu_pembayaran', 'diproses', 'selesai', 'dibatalkan']
  if (!allowed.includes(status)) throw new Error('Status tidak valid')
  const r = db.prepare(
    "UPDATE store_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE invoice_number = ?"
  ).run(status, String(invoice).toUpperCase().trim())
  return r.changes > 0
}

export function getVoucher(code) {
  const v = db.prepare('SELECT * FROM store_vouchers WHERE code = ? AND is_active = 1')
    .get(String(code).toUpperCase().trim())
  if (!v) return null
  if (v.max_uses && v.used_count >= v.max_uses) return null
  return v
}

export function listVouchers() {
  return db.prepare('SELECT code, discount_percent, is_active FROM store_vouchers WHERE is_active = 1').all()
}

export function upsertVoucher(code, discount_percent = 0, discount_nominal = 0, is_active = 1) {
  code = String(code).toUpperCase().trim()
  db.prepare(`
    INSERT INTO store_vouchers (code, discount_percent, discount_nominal, is_active)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET discount_percent = excluded.discount_percent, discount_nominal = excluded.discount_nominal, is_active = excluded.is_active
  `).run(code, discount_percent, discount_nominal, is_active ? 1 : 0)
  return db.prepare('SELECT * FROM store_vouchers WHERE code = ?').get(code)
}

export function deleteVoucher(code) {
  const r = db.prepare('DELETE FROM store_vouchers WHERE code = ?')
    .run(String(code).toUpperCase().trim())
  return r.changes > 0
}

export function getSetting(key) {
  const r = db.prepare('SELECT value FROM store_settings WHERE key = ?').get(key)
  return r ? r.value : null
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value)
}

export function listSettings() {
  return db.prepare('SELECT key, value FROM store_settings').all()
}

// Auto-cleanup: hapus order lama
// - dibatalkan > 30 hari → hapus
// - selesai > 365 hari → hapus
export function cleanupOldOrders() {
  const r1 = db.prepare(
    "DELETE FROM store_orders WHERE status = 'dibatalkan' AND created_at < datetime('now', '-30 days')"
  ).run()
  const r2 = db.prepare(
    "DELETE FROM store_orders WHERE status = 'selesai' AND created_at < datetime('now', '-365 days')"
  ).run()
  return { dibatalkan: r1.changes, selesai_lama: r2.changes }
}


export function listFlashsales(activeOnly = true) {
  const q = activeOnly
    ? 'SELECT * FROM store_flashsales WHERE is_active = 1 ORDER BY created_at DESC'
    : 'SELECT * FROM store_flashsales ORDER BY created_at DESC';
  return db.prepare(q).all();
}
export function upsertFlashsale(id, data) {
  if (id) {
    db.prepare(`UPDATE store_flashsales SET product_name=?, normal_price=?, sale_price=?, stock=?, is_active=? WHERE id=?`)
      .run(data.product_name, data.normal_price, data.sale_price, data.stock ?? 10, data.is_active ? 1 : 0, id);
    return db.prepare('SELECT * FROM store_flashsales WHERE id=?').get(id);
  }
  const r = db.prepare(`INSERT INTO store_flashsales (product_name, normal_price, sale_price, stock, is_active) VALUES (?,?,?,?,?)`)
    .run(data.product_name, data.normal_price, data.sale_price, data.stock ?? 10, data.is_active ? 1 : 0);
  return db.prepare('SELECT * FROM store_flashsales WHERE id=?').get(r.lastInsertRowid);
}
export function deleteFlashsale(id) {
  return db.prepare('DELETE FROM store_flashsales WHERE id=?').run(id).changes > 0;
}


// ---- Products ----
export function listProducts(activeOnly = true) {
  const q = activeOnly
    ? 'SELECT * FROM store_products WHERE is_active = 1 ORDER BY sort_order, name'
    : 'SELECT * FROM store_products ORDER BY sort_order, name';
  return db.prepare(q).all();
}
export function upsertProduct(id, data) {
  if (id) {
    db.prepare(`UPDATE store_products SET name=?, category=?, price=?, description=?, is_active=?, sort_order=? WHERE id=?`)
      .run(data.name, data.category || '', data.price, data.description || '', data.is_active ? 1 : 0, data.sort_order || 0, id);
    return db.prepare('SELECT * FROM store_products WHERE id=?').get(id);
  }
  const r = db.prepare(`INSERT INTO store_products (name, category, price, description, is_active, sort_order) VALUES (?,?,?,?,?,?)`)
    .run(data.name, data.category || '', data.price, data.description || '', data.is_active ? 1 : 0, data.sort_order || 0);
  return db.prepare('SELECT * FROM store_products WHERE id=?').get(r.lastInsertRowid);
}
export function deleteProduct(id) {
  return db.prepare('DELETE FROM store_products WHERE id=?').run(id).changes > 0;
}

// ---- Stats ----
export function getStats() {
  const total = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(total),0) s FROM store_orders WHERE status != 'dibatalkan'`).get();
  const today = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(total),0) s FROM store_orders WHERE date(created_at) = date('now') AND status != 'dibatalkan'`).get();
  const byStatus = db.prepare(`SELECT status, COUNT(*) c FROM store_orders GROUP BY status`).all();
  const byDay = db.prepare(`SELECT date(created_at) d, COUNT(*) c, COALESCE(SUM(total),0) s FROM store_orders WHERE created_at >= date('now','-7 days') GROUP BY d ORDER BY d`).all();
  const topProducts = db.prepare(`SELECT product_name, COUNT(*) c, COALESCE(SUM(total),0) s FROM store_orders WHERE status != 'dibatalkan' GROUP BY product_name ORDER BY c DESC LIMIT 5`).all();
  const vouchers = db.prepare(`SELECT COUNT(*) c FROM store_vouchers WHERE is_active=1`).get();
  return { total_orders: total.c, total_revenue: total.s, today_orders: today.c, today_revenue: today.s, by_status: byStatus, by_day: byDay, top_products: topProducts, active_vouchers: vouchers.c };
}

// ---- Birthdays ----
export function listBirthdays() {
  return db.prepare(`SELECT * FROM store_birthdays ORDER BY substr(birthdate,6)`).all();
}
export function upsertBirthday(id, data) {
  if (id) {
    db.prepare(`UPDATE store_birthdays SET name=?, whatsapp=?, birthdate=? WHERE id=?`).run(data.name, data.whatsapp || '', data.birthdate, id);
    return db.prepare('SELECT * FROM store_birthdays WHERE id=?').get(id);
  }
  const r = db.prepare(`INSERT INTO store_birthdays (name, whatsapp, birthdate) VALUES (?,?,?)`).run(data.name, data.whatsapp || '', data.birthdate);
  return db.prepare('SELECT * FROM store_birthdays WHERE id=?').get(r.lastInsertRowid);
}
export function deleteBirthday(id) {
  return db.prepare('DELETE FROM store_birthdays WHERE id=?').run(id).changes > 0;
}
export function getUpcomingBirthdays(days = 7) {
  return db.prepare(`
    SELECT *, 
      CASE 
        WHEN substr(birthdate,6) >= substr(date('now'),6) THEN substr(strftime('%Y','now') || '-' || substr(birthdate,6),1,10)
        ELSE substr((strftime('%Y','now')+1) || '-' || substr(birthdate,6),1,10)
      END as next_bday
    FROM store_birthdays
    WHERE julianday(
      CASE 
        WHEN substr(birthdate,6) >= substr(date('now'),6) THEN strftime('%Y','now') || '-' || substr(birthdate,6)
        ELSE (strftime('%Y','now')+1) || '-' || substr(birthdate,6)
      END
    ) - julianday('now') <= ?
    ORDER BY next_bday
  `).all(days);
}

export default db
