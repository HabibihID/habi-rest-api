// vcc — Virtual Credit Card generator (nomor testing/dummy).
// 100% lokal, tanpa dependency eksternal.

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const NETWORKS = {
  Visa: { bin: () => '4', length: 16, cvvLen: 3 },
  MasterCard: { bin: () => pick([randInt(51, 55).toString(), randInt(2221, 2720).toString()]), length: 16, cvvLen: 3 },
  AmericanExpress: { bin: () => pick(['34', '37']), length: 15, cvvLen: 4 },
  Discover: { bin: () => pick(['6011', '65', randInt(644, 649).toString()]), length: 16, cvvLen: 3 },
  JCB: { bin: () => randInt(3528, 3589).toString(), length: 16, cvvLen: 3 },
  DinersClub: { bin: () => '36', length: 14, cvvLen: 3 },
  ChinaUnionPay: { bin: () => '62', length: 16, cvvLen: 3 },
}

function luhnValid(num) {
  let sum = 0, alt = false
  for (let i = num.length - 1; i >= 0; i--) {
    let d = parseInt(num[i], 10)
    if (alt) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}

function generateNumber(network) {
  const cfg = NETWORKS[network]
  const bin = cfg.bin()
  let partial = bin
  while (partial.length < cfg.length - 1) partial += randInt(0, 9).toString()
  for (let d = 0; d <= 9; d++) {
    if (luhnValid(partial + d)) { partial += d; break }
  }
  return partial
}

const FIRST = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Daniel', 'Paul', 'Mark', 'Amanda', 'Melissa', 'Emily', 'Hannah', 'Megan', 'Liam', 'Noah', 'Oliver', 'Ava', 'Sophia', 'Isabella', 'Mia']
const LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Martin', 'Lee', 'White', 'Harris', 'Clark', 'Lewis', 'Walker']

export function generateCard(network) {
  const cfg = NETWORKS[network]
  if (!cfg) throw new Error(`Network tidak dikenal: ${network}`)
  return {
    network,
    number: generateNumber(network),
    name: pick(FIRST) + ' ' + pick(LAST),
    expiry: String(randInt(1, 12)).padStart(2, '0') + '/' + String(new Date().getFullYear() + randInt(1, 5)).slice(2),
    cvv: String(randInt(cfg.cvvLen === 4 ? 1000 : 100, cfg.cvvLen === 4 ? 9999 : 999)),
  }
}

export const VALID_NETWORKS = Object.keys(NETWORKS)
