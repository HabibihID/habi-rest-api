// Auto-cleanup order lama — dijalankan via cron tiap hari jam 3 pagi
import { cleanupOldOrders } from './lib/store-db.js'
const r = cleanupOldOrders()
console.log(new Date().toISOString(), 'cleanup:', JSON.stringify(r))
