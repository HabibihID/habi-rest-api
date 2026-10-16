// Store routes — backend toko Habibi Store
// Mount di /store/* (TERPISAH dari /api/*, tanpa API key, tanpa bentrok)
// Endpoints publik:
//   POST /store/order            → buat order baru
//   GET  /store/order/:invoice   → lacak pesanan
//   GET  /store/vouchers         → daftar voucher aktif
//   GET  /store/voucher/:code    → cek 1 voucher
//   GET  /store/settings        → pengaturan publik (nama toko, no WA)
// Endpoints admin (butuh header x-admin-key = ADMIN_KEY env):
//   GET    /store/admin/orders            → list order (?status=)
//   PATCH  /store/admin/orders/:invoice   → ubah status {status}
//   GET    /store/admin/vouchers          → list semua voucher
//   POST   /store/admin/vouchers          → tambah/update {code, discount_percent, is_active}
//   DELETE /store/admin/vouchers/:code    → hapus voucher
//   GET    /store/admin/settings          → semua settings
//   POST   /store/admin/settings          → set {key, value}

import { Router } from 'express'
import {
  createOrder, getOrder, listOrders, updateOrderStatus,
  getVoucher, listVouchers, upsertVoucher, deleteVoucher,
  getSetting, setSetting, listSettings,
  listFlashsales, upsertFlashsale, deleteFlashsale,
  listProducts, upsertProduct, deleteProduct,
  getStats,
  listBirthdays, upsertBirthday, deleteBirthday, getUpcomingBirthdays,
} from '../lib/store-db.js'

const router = Router()
const ADMIN_KEY = process.env.STORE_ADMIN_KEY || 'habibi-admin-123'

function adminAuth(req, res, next) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ status: false, message: 'Unauthorized' })
  }
  next()
}

// ---- Publik ----
router.post('/store/order', (req, res) => {
  try {
    const { product_name, payment_method, flashsale_id, product_id } = req.body || {}
    if (!product_name || !payment_method) {
      return res.status(400).json({ status: false, message: 'product_name dan payment_method wajib diisi' })
    }
    // === VALIDASI HARGA DI SERVER (jangan percaya harga dari browser!) ===
    let serverPrice = null
    const flashsales = listFlashsales(true)
    const fs = flashsales.find(f => f.product_name === product_name || (flashsale_id && String(f.id) === String(flashsale_id)))
    if (fs && Number(fs.stock) > 0) {
      serverPrice = Number(fs.sale_price)
    } else {
      const products = listProducts(true)
      const p = products.find(p => p.name === product_name || (product_id && String(p.id) === String(product_id)))
      if (p) serverPrice = Number(p.price)
    }
    if (serverPrice == null || !(serverPrice > 0)) {
      return res.status(400).json({ status: false, message: 'Produk tidak ditemukan atau harga tidak valid' })
    }
    const subtotal = serverPrice
    let discount = 0
    let voucher_code = null
    if (req.body.voucher_code) {
      const v = getVoucher(req.body.voucher_code)
      if (!v) return res.status(400).json({ status: false, message: 'Voucher tidak valid' })
      voucher_code = String(req.body.voucher_code).toUpperCase()
      if (Number(v.discount_nominal) > 0) discount = Math.min(Number(v.discount_nominal), subtotal)
      else discount = Math.round(subtotal * Number(v.discount_percent || 0) / 100)
    }
    const total = Math.max(0, subtotal - discount)
    const order = createOrder({ ...req.body, subtotal, discount, total, voucher_code })
    res.json({ status: true, data: order })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})


router.get('/store/order/:invoice', (req, res) => {
  const order = getOrder(req.params.invoice)
  if (!order) return res.status(404).json({ status: false, message: 'Invoice tidak ditemukan' })
  const labels = {
    menunggu_pembayaran: 'Menunggu Pembayaran',
    diproses: 'Diproses',
    selesai: 'Selesai',
    dibatalkan: 'Dibatalkan',
  }
  res.json({ status: true, data: { ...order, status_label: labels[order.status] || order.status } })
})

router.get('/store/vouchers', (req, res) => {
  res.json({ status: true, data: listVouchers() })
})

router.get('/store/voucher/:code', (req, res) => {
  const v = getVoucher(req.params.code)
  if (!v) return res.status(404).json({ status: false, message: 'Voucher tidak valid' })
  res.json({ status: true, data: { code: v.code, discount_percent: v.discount_percent, discount_nominal: v.discount_nominal || 0 } })
})

router.get('/store/settings', (req, res) => {
  res.json({
    status: true,
    data: {
      store_name: getSetting('store_name'),
      whatsapp_number: getSetting('whatsapp_number'),
      checkout_greeting: getSetting('checkout_greeting'),
    },
  })
})

// ---- Admin ----
router.get('/store/admin/orders', adminAuth, (req, res) => {
  res.json({ status: true, data: listOrders(req.query.status, Number(req.query.limit) || 50) })
})

router.patch('/store/admin/orders/:invoice', adminAuth, (req, res) => {
  try {
    const ok = updateOrderStatus(req.params.invoice, req.body.status)
    if (!ok) return res.status(404).json({ status: false, message: 'Invoice tidak ditemukan' })
    res.json({ status: true, data: getOrder(req.params.invoice) })
  } catch (e) {
    res.status(400).json({ status: false, message: e.message })
  }
})

router.get('/store/admin/vouchers', adminAuth, (req, res) => {
  // list semua termasuk nonaktif — pakai listVouchers internal via db langsung
  res.json({ status: true, data: listVouchers() })
})

router.post('/store/admin/vouchers', adminAuth, (req, res) => {
  const { code, discount_percent, discount_nominal, is_active } = req.body || {}
  if (!code) return res.status(400).json({ status: false, message: 'code wajib diisi' })
  const pct = Number(discount_percent) || 0, nom = Number(discount_nominal) || 0
  if (pct < 0 || pct > 100) return res.status(400).json({ status: false, message: 'discount_percent 0-100' })
  if (nom < 0) return res.status(400).json({ status: false, message: 'discount_nominal >= 0' })
  res.json({ status: true, data: upsertVoucher(code, pct, nom, is_active !== false) })
})

router.delete('/store/admin/vouchers/:code', adminAuth, (req, res) => {
  const ok = deleteVoucher(req.params.code)
  if (!ok) return res.status(404).json({ status: false, message: 'Voucher tidak ditemukan' })
  res.json({ status: true, message: 'Voucher dihapus' })
})

router.get('/store/admin/settings', adminAuth, (req, res) => {
  res.json({ status: true, data: listSettings() })
})

router.post('/store/admin/settings', adminAuth, (req, res) => {
  const { key, value } = req.body || {}
  if (!key || value == null) return res.status(400).json({ status: false, message: 'key & value wajib diisi' })
  setSetting(key, String(value))
  res.json({ status: true, data: { key, value: String(value) } })
})


// ---- Flash sale publik ----
router.get('/store/flashsales', (req, res) => {
  res.json({ status: true, data: listFlashsales(true) })
})

// ---- Flash sale admin ----
router.get('/store/admin/flashsales', adminAuth, (req, res) => {
  res.json({ status: true, data: listFlashsales(false) })
})
router.post('/store/admin/flashsales', adminAuth, (req, res) => {
  const { id, product_name, normal_price, sale_price, stock, is_active, ends_at } = req.body || {}
  if (!product_name || normal_price == null || sale_price == null)
    return res.status(400).json({ status: false, message: 'product_name, normal_price, sale_price wajib diisi' })
  res.json({ status: true, data: upsertFlashsale(id || null, { product_name, normal_price, sale_price, stock, is_active, ends_at }) })
})
router.delete('/store/admin/flashsales/:id', adminAuth, (req, res) => {
  const ok = deleteFlashsale(req.params.id)
  if (!ok) return res.status(404).json({ status: false, message: 'Tidak ditemukan' })
  res.json({ status: true, message: 'Dihapus' })
})


// ---- Products publik ----
router.get('/store/products', (req, res) => {
  res.json({ status: true, data: listProducts(true) })
})

// ---- Products admin ----
router.get('/store/admin/products', adminAuth, (req, res) => {
  res.json({ status: true, data: listProducts(false) })
})
router.post('/store/admin/products', adminAuth, (req, res) => {
  const { id, name, category, price, description, is_active, sort_order } = req.body || {}
  if (!name || price == null) return res.status(400).json({ status: false, message: 'name & price wajib diisi' })
  res.json({ status: true, data: upsertProduct(id || null, { name, category, price, description, is_active, sort_order }) })
})
router.delete('/store/admin/products/:id', adminAuth, (req, res) => {
  const ok = deleteProduct(req.params.id)
  if (!ok) return res.status(404).json({ status: false, message: 'Tidak ditemukan' })
  res.json({ status: true, message: 'Dihapus' })
})

// ---- Stats ----
router.get('/store/admin/stats', adminAuth, (req, res) => {
  res.json({ status: true, data: getStats() })
})

// ---- Export CSV ----
router.get('/store/admin/orders/export', adminAuth, (req, res) => {
  const orders = listOrders(req.query.status || null, 10000)
  const header = 'Invoice,Tanggal,Pelanggan,Produk,Subtotal,Diskon,Total,Status,Pembayaran\n'
  const rows = orders.map(o => [
    o.invoice_number, o.created_at, '"' + (o.customer_name || '').replace(/"/g, '""') + '"',
    '"' + (o.product_name || '').replace(/"/g, '""') + '"',
    o.subtotal, o.discount, o.total, o.status, o.payment_method || ''
  ].join(',')).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="orders-' + new Date().toISOString().slice(0,10) + '.csv"')
  res.send('\ufeff' + header + rows)
})

// ---- Birthdays ----
router.get('/store/admin/birthdays', adminAuth, (req, res) => {
  res.json({ status: true, data: listBirthdays() })
})
router.get('/store/admin/birthdays/upcoming', adminAuth, (req, res) => {
  res.json({ status: true, data: getUpcomingBirthdays(parseInt(req.query.days, 10) || 7) })
})
router.post('/store/admin/birthdays', adminAuth, (req, res) => {
  const { id, name, whatsapp, birthdate } = req.body || {}
  if (!name || !birthdate) return res.status(400).json({ status: false, message: 'name & birthdate (YYYY-MM-DD) wajib diisi' })
  res.json({ status: true, data: upsertBirthday(id || null, { name, whatsapp, birthdate }) })
})
router.delete('/store/admin/birthdays/:id', adminAuth, (req, res) => {
  const ok = deleteBirthday(req.params.id)
  if (!ok) return res.status(404).json({ status: false, message: 'Tidak ditemukan' })
  res.json({ status: true, message: 'Dihapus' })
})

export default router
