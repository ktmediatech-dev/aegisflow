// Approximate exchange rates relative to 1 USD (update periodically as needed)
export const CURRENCIES = [
  { code: 'KES', label: 'Kenyan Shilling', symbol: 'KSh', rate: 129 },
  { code: 'USD', label: 'US Dollar', symbol: '$', rate: 1 },
  { code: 'UGX', label: 'Ugandan Shilling', symbol: 'USh', rate: 3750 },
  { code: 'TSH', label: 'Tanzanian Shilling', symbol: 'TSh', rate: 2600 },
  { code: 'RWF', label: 'Rwandan Franc', symbol: 'FRw', rate: 1300 },
  { code: 'BIF', label: 'Burundian Franc', symbol: 'FBu', rate: 2880 },
  { code: 'EUR', label: 'Euro', symbol: '€', rate: 0.92 },
  { code: 'GBP', label: 'British Pound', symbol: '£', rate: 0.79 },
  { code: 'ZAR', label: 'South African Rand', symbol: 'R', rate: 18.3 },
]

export const getCurrency = (code) => CURRENCIES.find(c => c.code === code) || CURRENCIES[0]

// Base data in the app is stored in KES. Converts a KES amount into the target currency.
export const convertFromKES = (amountInKES, targetCode) => {
  const kes = getCurrency('KES')
  const target = getCurrency(targetCode)
  const usdAmount = amountInKES / kes.rate
  return usdAmount * target.rate
}

// Formats a KES-denominated amount into the selected currency, with compact notation for large numbers.
export const formatCurrency = (amountInKES, currencyCode = 'USD', { compact = true } = {}) => {
  const target = getCurrency(currencyCode)
  const converted = convertFromKES(amountInKES, currencyCode)

  if (compact) {
    if (Math.abs(converted) >= 1_000_000) return `${target.symbol} ${(converted / 1_000_000).toFixed(1)}M`
    if (Math.abs(converted) >= 1_000) return `${target.symbol} ${(converted / 1_000).toFixed(0)}K`
  }
  return `${target.symbol} ${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}
