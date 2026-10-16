import { Router } from 'express'
import { createPayment, activeProviders } from '../lib/payment/providers.js'

const router = Router()
// penyimpanan status sederhana (in-memory). Untuk production pakai DB.
const payments = new Map()

// POST /api/payment/create {amount, method, order_id}
router.post('/create', async (req, res) => {
  const { amount, method, order_id } = req.body || {}
  const r = await createPayment(amount, method, order_id)
  if (!r.ok) return res.json({ status: false, message: r.error, code: r.code, details: r.details || [] })
  payments.set(r.reference, { ...r, created_at: new Date().toISOString() })
  res.json({ status: true, data: r })
})

// GET /api/payment/status/:reference
router.get('/status/:reference', (req, res) => {
  const p = payments.get(req.params.reference)
  if (!p) return res.status(404).json({ status: false, message: 'Reference tidak ditemukan' })
  res.json({ status: true, data: { reference: p.reference, amount: p.amount, status: p.status, provider: p.provider } })
})

// GET /api/payment/providers
router.get('/providers', (req, res) => {
  res.json({ status: true, data: activeProviders() })
})

// POST /api/payment/callback — webhook dari provider (tripay/xendit)
router.post('/callback', (req, res) => {
  const { reference, status } = req.body || {}
  const p = payments.get(reference)
  if (p && status) {
    p.status = status
    payments.set(reference, p)
  }
  res.json({ status: true })
})

export default router
