// Card entry for checkout. The details go to the backend once, over the session's
// connection, and are never kept in browser storage (CON-5, SEC-2).

export type Card = { number: string; expiryMonth: number; expiryYear: number; cvv: string; holderName: string }
export type CardFields = { number: string; expiry: string; cvv: string; holderName: string }

/** Test cards accepted by the simulated gateway. Any other valid number is declined. */
export const testCards = [
  { type: 'Visa', number: '4242 4242 4242 4242' },
  { type: 'Mastercard', number: '5555 5555 5555 4444' },
  { type: 'American Express', number: '3782 822463 10005' },
]

function passesLuhnCheck(digits: string): boolean {
  let sum = 0
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9 }
    sum += digit
  }
  return sum % 10 === 0
}

/** The card to send, or a message saying which field to correct. */
export function readCard(fields: CardFields, today = new Date()): Card | string {
  const number = fields.number.replace(/[\s-]/g, '')
  if (!/^[0-9]{12,19}$/.test(number) || !passesLuhnCheck(number)) return 'Enter a valid card number.'
  const expiry = /^\s*(0?[1-9]|1[0-2])\s*\/\s*([0-9]{2}|[0-9]{4})\s*$/.exec(fields.expiry)
  if (!expiry) return 'Enter the expiry date as MM/YY.'
  const expiryMonth = Number(expiry[1])
  const expiryYear = expiry[2].length === 2 ? 2000 + Number(expiry[2]) : Number(expiry[2])
  if (expiryYear < today.getFullYear() || (expiryYear === today.getFullYear() && expiryMonth < today.getMonth() + 1)) {
    return 'This card has expired.'
  }
  const cvv = fields.cvv.trim()
  if (!/^[0-9]{3,4}$/.test(cvv)) return 'Enter the 3 or 4 digit security code.'
  const holderName = fields.holderName.trim()
  if (!holderName || holderName.length > 100) return 'Enter the name on the card.'
  return { number, expiryMonth, expiryYear, cvv, holderName }
}
