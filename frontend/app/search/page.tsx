'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/layout/Navbar'
import FilterSidebar from '@/components/filters/FilterSidebar'
import ProductCard from '@/components/product/ProductCard'
import ProductDetailModal from '@/components/product/ProductDetailModal'
import { apiUrl, api } from '@/lib/api'
import type { Product, ProductFilters, ProductsResponse } from '@/types'

export default function SearchPage() {
  const { data: session } = useSession()
  const email = session?.user?.email ?? ''
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ProductFilters>({})
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // AI search state
  const [aiMode, setAiMode] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiInterpreting, setAiInterpreting] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (filters.material_category) params.set('material_category', filters.material_category)
        if (filters.supplier) params.set('supplier', filters.supplier)
        if (filters.min_price != null) params.set('min_price', String(filters.min_price))
        if (filters.max_price != null) params.set('max_price', String(filters.max_price))
        if (filters.in_stock != null) params.set('in_stock', String(filters.in_stock))
        if (filters.brand) params.set('brand', filters.brand)
        const res = await fetch(`${apiUrl('/products')}?${params}`, {
          headers: email ? { 'X-User-Email': email } : {},
        })
        const json = await res.json()
        setData(json)
        setError(null)
      } catch (e) {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search, filters])

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) return
    setAiInterpreting(true)
    setAiSummary(null)
    setAiError(null)
    try {
      const result = await api.interpretSearch(aiQuery)
      setAiSummary(result.interpreted)

      // Try progressively looser filter sets until we get results
      const attempts = [
        // Most specific: all filters
        { search: result.search ?? '', material_category: result.material_category ?? undefined, brand: result.brand ?? undefined },
        // Drop brand
        { search: result.search ?? '', material_category: result.material_category ?? undefined },
        // Drop category too — just keyword
        { search: result.search ?? '' },
        // Fall back to the category as the search keyword
        { search: result.material_category ?? result.search ?? '' },
      ]

      for (const attempt of attempts) {
        const params = new URLSearchParams()
        if (attempt.search) params.set('search', attempt.search)
        if ('material_category' in attempt && attempt.material_category) params.set('material_category', attempt.material_category)
        if ('brand' in attempt && attempt.brand) params.set('brand', attempt.brand)
        params.set('page_size', '1')

        const res = await fetch(`${apiUrl('/products')}?${params}`)
        const json = await res.json()
        if (json.total > 0) {
          setSearch(attempt.search)
          setFilters({
            material_category: 'material_category' in attempt ? attempt.material_category : undefined,
            brand: 'brand' in attempt ? (attempt as any).brand : undefined,
          })
          break
        }
      }
    } catch {
      setAiError('AI search failed. Try a regular keyword search instead.')
    } finally {
      setAiInterpreting(false)
    }
  }

  return (
    <>
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search products — e.g. '3M vinyl', 'aluminum panel', 'LED module'..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-36 py-4 rounded-2xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 text-white placeholder-slate-500 transition-all text-base"
            />
            <button
              onClick={() => { setAiMode(m => !m); setAiSummary(null); setAiError(null) }}
              className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                aiMode
                  ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                  : 'bg-white/[0.06] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Search
            </button>
          </div>

          {/* AI natural language panel */}
          <AnimatePresence>
            {aiMode && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4"
              >
                <p className="text-xs text-purple-300 font-medium mb-2">Describe what you need in plain English</p>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={aiQuery}
                    onChange={e => setAiQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                    placeholder="e.g. matte black wrap for a pickup truck, or white cast vinyl for outdoor signs"
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20"
                  />
                  <button
                    onClick={handleAiSearch}
                    disabled={aiInterpreting || !aiQuery.trim()}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shrink-0"
                  >
                    {aiInterpreting ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : 'Search'}
                  </button>
                </div>
                {aiSummary && (
                  <p className="text-xs text-purple-300/70 mt-2">Understood: {aiSummary}</p>
                )}
                {aiError && (
                  <p className="text-xs text-red-400 mt-2">{aiError}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex gap-6">
          <FilterSidebar filters={filters} onChange={setFilters} />

          <div className="flex-1">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {isLoading ? 'Loading...' : `${data?.total ?? 0} products`}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-2xl border border-white/10 p-4 h-48 animate-pulse">
                      <div className="h-4 bg-white/[0.05] rounded w-3/4 mb-3" />
                      <div className="h-3 bg-white/[0.05] rounded w-1/2 mb-2" />
                      <div className="h-3 bg-white/[0.05] rounded w-2/3" />
                    </div>
                  ))}
                </motion.div>
              ) : error ? (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
                  <p className="text-red-400 font-medium mb-1">Could not reach backend</p>
                  <p className="text-sm text-slate-500">{error}</p>
                  <p className="text-xs text-slate-600 mt-2">Backend may be waking up — wait 20 seconds and try again.</p>
                </motion.div>
              ) : !data?.products?.length ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-24"
                >
                  <div className="w-16 h-16 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-white font-medium mb-1">No products found</p>
                  <p className="text-sm text-slate-500">Try a different search term or load demo data in Settings.</p>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {data.products.map((product: Product, i: number) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      <ProductCard product={product} onClick={() => setSelectedProduct(product)} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>

    <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </>
  )
}
