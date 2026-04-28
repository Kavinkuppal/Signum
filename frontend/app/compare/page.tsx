'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { SUPPLIER_COLORS, SUPPLIER_DOT, supplierName } from '@/lib/suppliers'
import Navbar from '@/components/layout/Navbar'
import ProductDetailModal from '@/components/product/ProductDetailModal'
import type { Product as ProductType } from '@/types'


function SavingsBadge({ savings, unit }: { savings: number; unit?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20">
      Save ${savings.toFixed(3)}/{unit ?? 'unit'}
    </span>
  )
}

interface Product {
  id: string
  supplier_name: string
  sku: string
  title: string
  brand: string | null
  material_category: string | null
  price: number
  normalized_price: number | null
  normalized_unit: string | null
  pack_quantity: number | null
  in_stock: boolean
  lead_time_days: number | null
  product_url: string
  last_scraped_at: string
  color: string | null
  finish: string | null
  dimensions_length: number | null
  dimensions_width: number | null
}

interface ComparisonGroup {
  group_key: string
  category: string | null
  brand: string | null
  products: Product[]
  supplier_count: number
  best_price: number | null
  best_supplier: string | null
  savings_per_unit: number | null
}

interface ComparisonResponse {
  groups: ComparisonGroup[]
  total_products: number
  query: string
}

function ComparisonTable({ group, onProductClick }: { group: ComparisonGroup; onProductClick: (p: Product) => void }) {
  const [expanded, setExpanded] = useState(true)
  const sorted = [...group.products].sort((a, b) =>
    (a.normalized_price ?? Infinity) - (b.normalized_price ?? Infinity)
  )

  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/10 overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white text-left text-sm">
                {group.brand ? `${group.brand} — ` : ''}{group.category}
              </h3>
              {group.supplier_count > 1 && (
                <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full font-medium border border-blue-500/20">
                  {group.supplier_count} suppliers
                </span>
              )}
              {group.savings_per_unit && group.supplier_count > 1 && (
                <SavingsBadge savings={group.savings_per_unit} unit={sorted[0]?.normalized_unit} />
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5 text-left">{group.products.length} product{group.products.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {group.best_supplier && (
            <span className="text-xs text-slate-500 hidden md:block">
              Best: <span className="font-medium text-slate-300">{supplierName(group.best_supplier)}</span>
              {group.best_price && <span className="text-slate-500"> · ${group.best_price.toFixed(3)}/{sorted[0]?.normalized_unit}</span>}
            </span>
          )}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Table */}
            <div className="border-t border-white/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.02] text-xs text-slate-500 uppercase tracking-wider">
                    <th className="text-left px-6 py-3 font-medium">Product</th>
                    <th className="text-left px-4 py-3 font-medium">Supplier</th>
                    <th className="text-right px-4 py-3 font-medium">Price</th>
                    <th className="text-right px-4 py-3 font-medium">Per Unit</th>
                    <th className="text-center px-4 py-3 font-medium">Stock</th>
                    <th className="text-center px-4 py-3 font-medium">Lead Time</th>
                    <th className="text-right px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {sorted.map((product, i) => {
                    const isBest = product.supplier_name === group.best_supplier && i === 0
                    return (
                      <tr
                        key={product.id}
                        onClick={() => onProductClick(product)}
                        className={`transition-colors cursor-pointer ${isBest && group.supplier_count > 1 ? 'bg-emerald-500/5 hover:bg-emerald-500/8' : 'hover:bg-white/[0.02]'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isBest && group.supplier_count > 1 && (
                              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                              </svg>
                            )}
                            <div>
                              <p className="font-medium text-white line-clamp-1">{product.title}</p>
                              <p className="text-xs text-slate-600 font-mono mt-0.5">{product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${SUPPLIER_COLORS[product.supplier_name] ?? 'bg-white/[0.06] text-slate-400 border-white/10'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${SUPPLIER_DOT[product.supplier_name] ?? 'bg-slate-500'}`} />
                            {supplierName(product.supplier_name)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-bold text-white">${product.price.toFixed(2)}</span>
                          {product.pack_quantity && product.pack_quantity > 1 && (
                            <p className="text-xs text-slate-600">pack of {product.pack_quantity}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {product.normalized_price ? (
                            <span className={`font-semibold ${isBest && group.supplier_count > 1 ? 'text-emerald-400' : 'text-slate-300'}`}>
                              ${product.normalized_price.toFixed(3)}
                              <span className="text-xs font-normal text-slate-500">/{product.normalized_unit}</span>
                            </span>
                          ) : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${product.in_stock ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                            {product.in_stock ? 'In stock' : 'Out'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-xs text-slate-500">
                          {product.lead_time_days ? `${product.lead_time_days}d` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a
                            href={product.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap"
                          >
                            Buy
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ComparePage() {
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null)

  const { data, isLoading, isFetching } = useQuery<ComparisonResponse>({
    queryKey: ['compare', submittedSearch, category],
    queryFn: async () => {
      const params = new URLSearchParams({ search: submittedSearch })
      if (category) params.append('material_category', category)
      const res = await fetch(apiUrl(`/products/compare?${params}`))
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: submittedSearch.length > 0,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittedSearch(search)
  }

  const multiSupplierGroups = data?.groups.filter(g => g.supplier_count > 1) ?? []
  const singleSupplierGroups = data?.groups.filter(g => g.supplier_count === 1) ?? []

  const selectClass = "border border-white/10 bg-white/[0.04] rounded-xl px-4 py-3.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [&>option]:bg-[#0d1224] [&>option]:text-white"

  return (
    <>
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Price Comparison</h1>
          <p className="text-slate-500 text-sm">Compare the same materials across Blue Ridge, McLogan, and USCutter side by side.</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. vinyl, aluminum, 3M, coroplast..."
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 text-white placeholder-slate-500"
              />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
              <option value="">All categories</option>
              {['Vinyl','Aluminum','LED','Substrate','Hardware','Ink','Laminate','Foam Board','Coroplast','Acrylic'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-xl font-medium transition-colors whitespace-nowrap"
            >
              Compare
            </button>
          </div>
        </form>

        {/* Quick searches */}
        {!submittedSearch && (
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="text-xs text-slate-600 self-center">Try:</span>
            {['vinyl', 'aluminum', '3M', 'coroplast', 'LED', 'laminate', 'oracal'].map((term) => (
              <button
                key={term}
                onClick={() => { setSearch(term); setSubmittedSearch(term) }}
                className="text-xs bg-white/[0.04] border border-white/10 text-slate-400 px-3 py-1.5 rounded-full hover:bg-white/[0.07] hover:border-white/20 hover:text-white transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {isLoading || (isFetching && !data) ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white/[0.03] rounded-2xl border border-white/10 p-6 animate-pulse">
                <div className="h-5 bg-white/[0.05] rounded w-48 mb-2" />
                <div className="h-4 bg-white/[0.05] rounded w-32" />
              </div>
            ))}
          </div>
        ) : data && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Summary bar */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl px-5 py-3 flex items-center gap-6 text-sm flex-wrap">
                <span className="text-slate-500">{data.total_products} products found for <strong className="text-white">"{data.query}"</strong></span>
                {multiSupplierGroups.length > 0 && (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    {multiSupplierGroups.length} cross-supplier comparison{multiSupplierGroups.length !== 1 ? 's' : ''} available
                  </span>
                )}
              </div>

              {/* Multi-supplier groups first */}
              {multiSupplierGroups.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                    Cross-supplier comparisons ({multiSupplierGroups.length})
                  </h2>
                  <div className="space-y-3">
                    {multiSupplierGroups.map((group) => (
                      <motion.div key={group.group_key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <ComparisonTable group={group} onProductClick={(p) => setSelectedProduct(p as unknown as ProductType)} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Single-supplier groups */}
              {singleSupplierGroups.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                    Other results ({singleSupplierGroups.length})
                  </h2>
                  <div className="space-y-3">
                    {singleSupplierGroups.map((group) => (
                      <motion.div key={group.group_key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <ComparisonTable group={group} onProductClick={(p) => setSelectedProduct(p as unknown as ProductType)} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {data.groups.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-white font-medium">No products found for "{data.query}"</p>
                  <p className="text-sm text-slate-500 mt-1">Try a different search term or load demo data in Settings.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {!submittedSearch && !isLoading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">Compare prices across suppliers</p>
            <p className="text-sm text-slate-500">Search for any material to see side-by-side pricing with normalized $/ft² costs.</p>
          </div>
        )}
      </main>

    </div>
    <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </>
  )
}
