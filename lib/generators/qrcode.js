// QR Code generator (pakai qrcode)
import QRCode from 'qrcode'

export async function qrGen(text) {
  return await QRCode.toBuffer(text, {
    type: 'png',
    width: 512,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  })
}
