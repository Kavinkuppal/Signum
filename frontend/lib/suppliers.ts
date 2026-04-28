export const SUPPLIER_DISPLAY: Record<string, string> = {
  blue_ridge: 'Blue Ridge',
  mclogan: 'McLogan',
  uscutter: 'USCutter',
}

export const SUPPLIER_COLORS: Record<string, string> = {
  blue_ridge: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  mclogan: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  uscutter: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
}

export const SUPPLIER_DOT: Record<string, string> = {
  blue_ridge: 'bg-blue-500',
  mclogan: 'bg-purple-500',
  uscutter: 'bg-orange-500',
}

export function supplierName(raw: string): string {
  return SUPPLIER_DISPLAY[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
