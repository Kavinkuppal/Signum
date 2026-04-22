'use client'

import { motion } from 'framer-motion'
import type { ProductFilters } from '@/types'

const MATERIAL_CATEGORIES = [
  'Vinyl', 'Aluminum', 'LED', 'Substrate', 'Hardware', 'Ink', 'Laminate', 'Foam Board', 'Coroplast', 'Acrylic'
]

const TIER1_SUPPLIERS = [
  { label: 'Blue Ridge', value: 'Blue Ridge Sign Supply' },
  { label: 'McLogan', value: 'McLogan' },
  { label: 'USCutter', value: 'USCutter' },
]

interface FilterSidebarProps {
  filters: ProductFilters
  onChange: (filters: ProductFilters) => void
  customSuppliers?: { name: string }[]
}

export default function FilterSidebar({ filters, onChange, customSuppliers = [] }: FilterSidebarProps) {
  const update = (key: keyof ProductFilters, value: ProductFilters[keyof ProductFilters]) => {
    onChange({ ...filters, [key]: value || undefined })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  const selectClass = "w-full text-sm border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white/[0.04] text-slate-300 [&>option]:bg-[#0d1224] [&>option]:text-white"
  const inputClass = "w-full text-sm border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white/[0.04] text-slate-300 placeholder-slate-600"

  return (
    <aside className="w-56 shrink-0">
      <div className="bg-white/[0.03] rounded-2xl border border-white/10 p-5 sticky top-20">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white text-sm">Filters</h2>
          {hasFilters && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => onChange({})}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              Clear all
            </motion.button>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Category</label>
            <select
              value={filters.material_category || ''}
              onChange={(e) => update('material_category', e.target.value)}
              className={selectClass}
            >
              <option value="">All categories</option>
              {MATERIAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Supplier</label>
            <select
              value={filters.supplier || ''}
              onChange={(e) => update('supplier', e.target.value)}
              className={selectClass}
            >
              <option value="">All suppliers</option>
              {TIER1_SUPPLIERS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
              {customSuppliers.length > 0 && (
                <optgroup label="My Suppliers">
                  {customSuppliers.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Price range</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.min_price || ''}
                onChange={(e) => update('min_price', e.target.value ? Number(e.target.value) : undefined)}
                className={inputClass}
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.max_price || ''}
                onChange={(e) => update('max_price', e.target.value ? Number(e.target.value) : undefined)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                filters.in_stock ? 'bg-blue-600 border-blue-600' : 'border-white/20 group-hover:border-white/40'
              }`}>
                {filters.in_stock && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                checked={filters.in_stock || false}
                onChange={(e) => update('in_stock', e.target.checked || undefined)}
                className="sr-only"
              />
              <span className="text-sm text-slate-400">In stock only</span>
            </label>
          </div>
        </div>
      </div>
    </aside>
  )
}
