'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import { apiUrl, api } from '@/lib/api'
import type { CustomSupplier } from '@/types'

const TIER1_SUPPLIERS = [
  {
    id: 'blue_ridge',
    name: 'Blue Ridge Sign Supply',
    url: 'blueridgesignsupply.com',
    description: 'Vinyl, substrates, and wide-format media. Scraped daily via public catalog.',
    color: 'from-blue-500 to-blue-700',
  },
  {
    id: 'mclogan',
    name: 'McLogan',
    url: 'mclogan.com',
    description: 'Inks, media, laminates, and sign supply equipment. Full catalog updated nightly.',
    color: 'from-purple-500 to-purple-700',
  },
  {
    id: 'uscutter',
    name: 'USCutter',
    url: 'uscutter.com',
    description: 'Vinyl cutters, heat presses, vinyl rolls, and accessories. Broad SKU coverage.',
    color: 'from-orange-500 to-orange-600',
  },
]

const STATUS_COLOR: Record<string, string> = {
  scraped: 'text-green-400',
  scraping: 'text-blue-400',
  pending: 'text-yellow-400',
  failed: 'text-red-400',
}

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const email = session?.user?.email ?? ''

  const [scrapeStatus, setScrapeStatus] = useState<Record<string, any>>({})
  const [scraping, setScraping] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [scrapeStarted, setScrapeStarted] = useState(false)

  // Custom suppliers state
  const [customSuppliers, setCustomSuppliers] = useState<CustomSupplier[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [addError, setAddError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rescrapingId, setRescrapingId] = useState<string | null>(null)

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
  }, [authStatus, router])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(apiUrl('/scrape/status'))
        const data = await res.json()
        setScrapeStatus(data)
      } catch {}
    }
    fetchStatus()
  }, [])

  const handleRunScrape = async () => {
    setScraping(true)
    setScrapeStarted(false)
    try {
      await fetch(apiUrl('/scrape/run/all'), { method: 'POST' })
      setScrapeStarted(true)
      setTimeout(async () => {
        try {
          const res = await fetch(apiUrl('/scrape/status'))
          const data = await res.json()
          setScrapeStatus(data)
        } catch {}
        setScraping(false)
      }, 3000)
    } catch {
      setScraping(false)
    }
  }

  const handleSeedData = async () => {
    setSeeding(true)
    try {
      await fetch(apiUrl('/demo/seed'), { method: 'POST' })
      setSeeded(true)
      setTimeout(() => setSeeded(false), 3000)
    } catch {}
    finally { setSeeding(false) }
  }

  const loadCustomSuppliers = useCallback(async () => {
    if (!email) return
    try {
      const data = await api.getCustomSuppliers(email)
      setCustomSuppliers(data)
    } catch {}
  }, [email])

  useEffect(() => { loadCustomSuppliers() }, [loadCustomSuppliers])

  // Poll while any supplier is scraping
  useEffect(() => {
    const active = customSuppliers.some(s => s.scrape_status === 'scraping' || s.scrape_status === 'pending')
    if (!active) return
    const t = setInterval(loadCustomSuppliers, 4000)
    return () => clearInterval(t)
  }, [customSuppliers, loadCustomSuppliers])

  const handleAddSupplier = async () => {
    if (!newUrl.trim()) return
    setAddingSupplier(true)
    setAddError('')
    try {
      await api.addCustomSupplier(email, newUrl.trim(), newName.trim() || undefined)
      setNewUrl('')
      setNewName('')
      await loadCustomSuppliers()
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      setAddError(typeof detail === 'string' ? detail : JSON.stringify(detail) ?? 'Failed to add supplier — check the URL and try again')
    } finally {
      setAddingSupplier(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await api.deleteCustomSupplier(email, id)
      setCustomSuppliers(prev => prev.filter(s => s.id !== id))
    } catch {}
    finally { setDeletingId(null) }
  }

  const handleRescrape = async (id: string) => {
    setRescrapingId(id)
    try {
      await api.rescrapeCustomSupplier(email, id)
      await loadCustomSuppliers()
    } catch {}
    finally { setRescrapingId(null) }
  }

  return (
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-slate-500 mb-8">Data sources and supplier catalog management.</p>
        </motion.div>

        {/* ── My Suppliers ─────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">My Suppliers</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste any supplier website — Signum scrapes it and adds those products only for your account.
            </p>
          </div>

          {/* Add form */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-4">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://suppliername.com"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSupplier()}
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-40 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/40"
                />
                <button
                  onClick={handleAddSupplier}
                  disabled={addingSupplier || !newUrl.trim()}
                  className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  {addingSupplier ? 'Adding…' : 'Add'}
                </button>
              </div>
              {addError && <p className="text-xs text-red-400">{addError}</p>}
              <p className="text-xs text-slate-600">
                Works with Shopify stores, WooCommerce sites, and most public product pages. Login-required sites cannot be scraped.
              </p>
            </div>
          </div>

          {/* Supplier list */}
          <AnimatePresence>
            {customSuppliers.length > 0 && (
              <motion.div className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {customSuppliers.map(s => {
                  const isActive = s.scrape_status === 'scraping' || s.scrape_status === 'pending'
                  const isSuccess = s.scrape_status === 'scraped'
                  const isFailed = s.scrape_status === 'failed'
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
                          {s.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{s.name}</span>
                            <a href={s.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                              {s.domain} ↗
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(isSuccess || isFailed) && (
                            <button
                              onClick={() => handleRescrape(s.id)}
                              disabled={rescrapingId === s.id}
                              className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                            >
                              {rescrapingId === s.id ? 'Re-scraping…' : 'Re-scrape'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId === s.id}
                            className="text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40"
                          >
                            {deletingId === s.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
                        {isActive && (
                          <motion.div
                            className="h-full bg-blue-500 rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: '80%' }}
                            transition={{ duration: 25, ease: 'easeOut' }}
                          />
                        )}
                        {isSuccess && (
                          <motion.div
                            className="h-full bg-green-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        )}
                        {isFailed && (
                          <motion.div
                            className="h-full bg-red-500/70 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.4 }}
                          />
                        )}
                      </div>

                      {/* Status line */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium ${STATUS_COLOR[s.scrape_status] ?? 'text-slate-500'}`}>
                          {s.scrape_status === 'pending' && 'Queued — starting soon…'}
                          {s.scrape_status === 'scraping' && 'Scraping product catalog…'}
                          {isSuccess && `Successfully scraped — ${s.products_found.toLocaleString()} products added to your search`}
                          {isFailed && `Scrape failed — ${s.scrape_error ?? 'Site may require login or use an unsupported format'}`}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          {isSuccess && s.scrape_strategy && (
                            <span className="text-xs text-slate-600 capitalize">via {s.scrape_strategy}</span>
                          )}
                          {s.last_scraped_at && (
                            <span className="text-xs text-slate-700">
                              {new Date(s.last_scraped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tier 1 Suppliers */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Tier 1 Suppliers</h2>
              <p className="text-xs text-slate-500 mt-0.5">Public catalogs — scraped automatically every night at 2 AM.</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRunScrape}
              disabled={scraping}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
            >
              {scraping ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Starting...
                </>
              ) : scrapeStarted ? '✓ Scrape started' : 'Refresh all now'}
            </motion.button>
          </div>

          <motion.div
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.08 } } }}
            className="space-y-3"
          >
            {TIER1_SUPPLIERS.map((supplier) => {
              const status = scrapeStatus[supplier.id]
              return (
                <motion.div
                  key={supplier.id}
                  variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.4 }}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden"
                >
                  <div className="flex items-center gap-5 p-5">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${supplier.color} flex items-center justify-center text-white text-base font-bold shrink-0`}>
                      {supplier.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-semibold text-white text-sm">{supplier.name}</h3>
                        <span className="text-xs text-slate-600">{supplier.url}</span>
                        <span className="inline-flex items-center gap-1 text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Auto-connected
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{supplier.description}</p>
                      {status && (
                        <p className="text-xs text-slate-600 mt-1">
                          {status.status === 'running' ? (
                            <span className="text-blue-400">Scraping in progress...</span>
                          ) : status.products_scraped > 0 ? (
                            `${status.products_scraped.toLocaleString()} products in catalog`
                          ) : null}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex gap-3 mb-4"
        >
          <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-300 mb-1">About Tier 1 suppliers</p>
            <p className="text-sm text-blue-400/70">
              Tier 1 suppliers have public product catalogs accessible via Shopify JSON APIs.
              No login required — data is refreshed every night. Tier 2 suppliers (Grimco, Fellers, Glantz)
              require authenticated sessions and are coming in a future release.
            </p>
          </div>
        </motion.div>

        {/* Demo data */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-sm font-semibold text-white mb-1">Demo Data</p>
            <p className="text-sm text-slate-500">Load 43 sample products for demo/testing without running a scrape.</p>
          </div>
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="shrink-0 bg-white/[0.07] hover:bg-white/[0.1] border border-white/10 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {seeding ? 'Loading...' : seeded ? '✓ Loaded' : 'Load Demo Data'}
          </button>
        </motion.div>
      </main>
    </div>
  )
}
