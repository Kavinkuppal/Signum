'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import FilterSidebar from '@/components/filters/FilterSidebar'
import ProductCard from '@/components/product/ProductCard'
import ProductDetailModal from '@/components/product/ProductDetailModal'
import { apiUrl } from '@/lib/api'
import type { Product, ProductFilters, ProductsResponse } from '@/types'

export default function SearchPage() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ProductFilters>({})
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
        const res = await fetch(`${apiUrl('/products')}?${params}`)
        const json = await res.json()
        setData(json)
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search, filters])

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
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 text-white placeholder-slate-500 transition-all text-base"
            />
          </div>
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
