'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'

interface Product {
  id: string; title: string; supplier_name: string; price: number
  normalized_price: number | null; normalized_unit: string | null
  product_url: string; in_stock: boolean; sku: string
}

interface ProjectItem {
  id: string; material_name: string; quantity: number; unit: string | null
  staged: boolean; purchased: boolean; purchase_price: number | null
  selected_product: Product | null
}

interface BOMMatch {
  item_id: string; material_name: string; quantity: number; unit: string | null
  best_match: Product | null; alternatives: Product[]; estimated_price: number | null
}

const SUPPLIER_COLORS: Record<string, string> = {
  blue_ridge: 'bg-blue-500/15 text-blue-400',
  mclogan: 'bg-purple-500/15 text-purple-400',
  uscutter: 'bg-orange-500/15 text-orange-400',
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [items, setItems] = useState<ProjectItem[]>([])
  const [bom, setBom] = useState<BOMMatch[]>([])
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [projRes, bomRes] = await Promise.all([
        fetch(`http://localhost:8000/api/v1/projects`),
        fetch(`http://localhost:8000/api/v1/projects/${id}/bom`)
      ])
      const projects = await projRes.json()
      const project = projects.find((p: any) => p.id === id)
      if (project) { setProjectName(project.name); setItems(project.items) }
      const bomData = await bomRes.json()
      setBom(bomData.matches || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const stageItem = async (itemId: string, productId: string) => {
    await fetch(`http://localhost:8000/api/v1/projects/${id}/items/${itemId}/stage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId })
    })
    await fetchData()
  }

  const unstageItem = async (itemId: string) => {
    await fetch(`http://localhost:8000/api/v1/projects/${id}/items/${itemId}/unstage`, { method: 'POST' })
    await fetchData()
  }

  const markPurchased = async (itemId: string, price?: number) => {
    setBuyingId(itemId)
    await fetch(`http://localhost:8000/api/v1/projects/${id}/items/${itemId}/purchase`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: price || null })
    })
    await fetchData()
    setBuyingId(null)
  }

  const stagedItems = items.filter(i => i.staged && !i.purchased)
  const purchasedItems = items.filter(i => i.purchased)
  const pendingItems = items.filter(i => !i.staged && !i.purchased)

  if (loading) return (
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <div className="flex items-center justify-center pt-32">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{projectName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{items.length} materials · {stagedItems.length} ready to buy · {purchasedItems.length} purchased</p>
          </div>
          <Link href="/search" className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Quick buy
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Materials */}
          <div className="lg:col-span-2 space-y-3">

            {/* Pending materials */}
            {pendingItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Needs decision ({pendingItems.length})</p>
                {pendingItems.map((item, i) => {
                  const match = bom.find(b => b.item_id === item.id)
                  const isOpen = activeItemId === item.id
                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden mb-2">
                      <button onClick={() => setActiveItemId(isOpen ? null : item.id)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.material_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">× {item.quantity} {item.unit}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {match?.best_match && (
                            <div className="text-right">
                              <p className="text-sm font-bold text-white">${match.estimated_price?.toFixed(2)}</p>
                              <p className="text-xs text-gray-600 capitalize">{match.best_match.supplier_name.replace('_', ' ')}</p>
                            </div>
                          )}
                          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-gray-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </motion.span>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && match && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="border-t border-white/10">
                            <div className="p-4 space-y-2">
                              {[match.best_match, ...match.alternatives].filter(Boolean).map((prod, pi) => prod && (
                                <div key={prod.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${pi === 0 ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{prod.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${SUPPLIER_COLORS[prod.supplier_name] || 'bg-gray-500/15 text-gray-400'}`}>{prod.supplier_name.replace('_', ' ')}</span>
                                      {pi === 0 && <span className="text-xs text-blue-400 font-medium">Best price</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 ml-3 shrink-0">
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-white">${prod.price.toFixed(2)}</p>
                                      {prod.normalized_price && <p className="text-xs text-gray-500">${prod.normalized_price.toFixed(3)}/{prod.normalized_unit}</p>}
                                    </div>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                      onClick={() => { stageItem(item.id, prod.id); setActiveItemId(null) }}
                                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                                    >
                                      Select
                                    </motion.button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* Purchased */}
            {purchasedItems.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Purchased ({purchasedItems.length})</p>
                {purchasedItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3 bg-white/[0.02] border border-white/5 rounded-xl mb-2 opacity-60">
                    <div>
                      <p className="text-sm text-gray-400">{item.material_name}</p>
                      <p className="text-xs text-gray-600">× {item.quantity} {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.selected_product && <span className="text-xs text-gray-600 capitalize">{item.selected_product.supplier_name.replace('_', ' ')}</span>}
                      <span className="text-green-500">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Buy List */}
          <div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 sticky top-20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-sm">Buy List</h3>
                <span className="text-xs text-gray-500">{stagedItems.length} items</span>
              </div>

              {stagedItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-600">No items staged yet.</p>
                  <p className="text-xs text-gray-700 mt-1">Select a supplier for each material to stage it here.</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {stagedItems.map(item => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{item.material_name}</p>
                          {item.selected_product && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate capitalize">{item.selected_product.supplier_name.replace('_', ' ')} · ${item.selected_product.price.toFixed(2)}</p>
                          )}
                        </div>
                        <button onClick={() => unstageItem(item.id)} className="text-gray-600 hover:text-gray-400 transition-colors shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {item.selected_product && (
                        <div className="flex items-center gap-2">
                          <a
                            href={item.selected_product.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => markPurchased(item.id, item.selected_product?.price)}
                            className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded-lg font-medium transition-colors"
                          >
                            Buy →
                          </a>
                          <button
                            onClick={() => markPurchased(item.id, item.selected_product?.price)}
                            disabled={buyingId === item.id}
                            className="text-xs text-gray-500 hover:text-green-400 border border-white/10 px-2 py-1.5 rounded-lg transition-colors"
                          >
                            ✓
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {stagedItems.length > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <p className="text-xs text-gray-500 mb-3">Est. total: <span className="text-white font-semibold">${stagedItems.reduce((sum, i) => sum + (i.selected_product?.price || 0) * i.quantity, 0).toFixed(2)}</span></p>
                  <p className="text-xs text-gray-600">Click "Buy →" on each item to open the supplier page, then mark ✓ when purchased.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
