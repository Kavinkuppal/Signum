'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import LocalSupplierCard from '@/components/suppliers/LocalSupplierCard'
import { api } from '@/lib/api'
import type { LocalSupplier, UserProfile } from '@/types'

interface DiscoveryStatus {
  total: number
  scraped: number
  scraping: number
  pending: number
  failed: number
  no_website: number
  done: number
  is_running: boolean
  percent: number
}

const STATUS_ORDER = ['scraped', 'scraping', 'pending', 'failed', 'login_required', 'no_website']

export default function LocalSuppliersPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [suppliers, setSuppliers] = useState<LocalSupplier[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [rescrapingId, setRescrapingId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'querying_osm' | 'scraping' | 'done'>('idle')
  const [useAi, setUseAi] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('signum_use_ai') === 'true'
    return false
  })

  const email = session?.user?.email ?? ''

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
  }, [authStatus, router])

  const loadStatus = useCallback(async () => {
    if (!email) return
    try {
      const s = await api.getDiscoveryStatus(email)
      setDiscoveryStatus(s)
      if (s.is_running) setPhase('scraping')
      else if (s.total > 0) setPhase('done')
    } catch {}
  }, [email])

  const loadSuppliers = useCallback(async () => {
    if (!email) return
    try {
      const [sups, prof] = await Promise.all([
        api.getLocalSuppliers(email),
        api.getLocationProfile(email),
      ])
      setSuppliers(sups)
      setProfile(prof)
    } catch {}
  }, [email])

  const loadAll = useCallback(async () => {
    await Promise.all([loadStatus(), loadSuppliers()])
    setIsLoading(false)
  }, [loadStatus, loadSuppliers])

  useEffect(() => {
    if (email) loadAll()
  }, [email, loadAll])

  // Poll every 3s while running
  useEffect(() => {
    if (!discoveryStatus?.is_running && phase !== 'querying_osm') return
    const interval = setInterval(loadAll, 3000)
    return () => clearInterval(interval)
  }, [discoveryStatus?.is_running, phase, loadAll])

  const handleDiscover = async () => {
    if (!email) return
    setIsDiscovering(true)
    setPhase('querying_osm')
    setSuppliers([])
    setDiscoveryStatus(null)
    try {
      await api.discoverLocalSuppliers(email, useAi)
      // Start polling — first results appear after OSM query (~5s)
      setTimeout(loadAll, 5000)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Discovery failed — save your location in Settings first.')
      setPhase('idle')
    } finally {
      setIsDiscovering(false)
    }
  }

  const handleRescrape = async (id: string) => {
    if (!email) return
    setRescrapingId(id)
    try {
      await api.rescrapeLocalSupplier(email, id)
      setTimeout(loadAll, 1500)
    } catch {}
    finally { setRescrapingId(null) }
  }

  const sorted = [...suppliers].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.scrape_status)
    const bi = STATUS_ORDER.indexOf(b.scrape_status)
    if (ai !== bi) return ai - bi
    return (b.rank_score ?? 0) - (a.rank_score ?? 0)
  })

  const scraped = sorted.filter((s) => s.scrape_status === 'scraped')
  const noProduct = sorted.filter((s) => s.scrape_status !== 'scraped')

  const isActive = phase === 'querying_osm' || phase === 'scraping' || discoveryStatus?.is_running

  if (authStatus === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-[#060b18]">
        <Navbar />
        <main className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 mb-6 flex-wrap"
        >
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Local Suppliers</h1>
            <p className="text-slate-500 text-sm">
              {profile?.zip_code || profile?.city
                ? `Suppliers within ${profile.search_radius_km} km of ${profile.zip_code ?? profile.city}`
                : 'Set your location in Settings to discover nearby suppliers.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {!profile?.lat && (
              <button onClick={() => router.push('/settings')} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Set location →
              </button>
            )}

            {/* AI scraping toggle */}
            {profile?.lat && (
              <button
                onClick={() => {
                  const next = !useAi
                  setUseAi(next)
                  localStorage.setItem('signum_use_ai', String(next))
                }}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  useAi
                    ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                    : 'bg-white/[0.04] border-white/10 text-slate-500 hover:text-slate-300'
                }`}
                title="AI extraction uses Claude Haiku API credits. Only enable if Shopify/WooCommerce/JSON-LD strategies fail."
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI scraping {useAi ? 'ON' : 'OFF'}
              </button>
            )}

            {profile?.lat && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleDiscover}
                disabled={!!isActive || isDiscovering}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                {isActive ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {suppliers.length ? 'Re-discover' : 'Discover suppliers'}
                  </>
                )}
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* ── Progress panel ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {(isActive || (phase === 'done' && discoveryStatus)) && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 bg-white/[0.03] border border-white/10 rounded-2xl p-5"
            >
              {/* Phase label */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isActive && (
                    <svg className="animate-spin w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {!isActive && phase === 'done' && (
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-white">
                    {phase === 'querying_osm' && 'Querying OpenStreetMap for nearby businesses…'}
                    {phase === 'scraping' && `Scraping supplier websites…`}
                    {phase === 'done' && 'Discovery complete'}
                  </span>
                </div>
                {discoveryStatus && discoveryStatus.total > 0 && (
                  <span className="text-xs text-slate-500">
                    {discoveryStatus.done} / {discoveryStatus.total}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {discoveryStatus && discoveryStatus.total > 0 ? (
                <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-3">
                  <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${discoveryStatus.percent}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              ) : (
                <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-3">
                  <motion.div
                    className="h-full w-1/3 bg-blue-500/60 rounded-full"
                    animate={{ x: ['0%', '200%'] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              )}

              {/* Stat pills */}
              {discoveryStatus && discoveryStatus.total > 0 && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-slate-500">
                    <span className="text-white font-medium">{discoveryStatus.total}</span> found
                  </span>
                  {discoveryStatus.scraped > 0 && (
                    <span className="text-green-400">
                      <span className="font-medium">{discoveryStatus.scraped}</span> indexed
                    </span>
                  )}
                  {(discoveryStatus.scraping + discoveryStatus.pending) > 0 && (
                    <span className="text-blue-400">
                      <span className="font-medium">{discoveryStatus.scraping + discoveryStatus.pending}</span> scraping
                    </span>
                  )}
                  {discoveryStatus.no_website > 0 && (
                    <span className="text-slate-500">
                      <span className="font-medium">{discoveryStatus.no_website}</span> contact for quote
                    </span>
                  )}
                  {discoveryStatus.failed > 0 && (
                    <span className="text-red-400/70">
                      <span className="font-medium">{discoveryStatus.failed}</span> failed
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* No location */}
        {!profile?.lat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
            <div className="w-16 h-16 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">No location set</p>
            <p className="text-sm text-slate-500 mb-6">Add your zip code or city in Settings so Signum can find local suppliers near you.</p>
            <button
              onClick={() => router.push('/settings')}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              Go to Settings
            </button>
          </motion.div>
        )}

        {/* Empty — location set but not yet discovered */}
        {profile?.lat && suppliers.length === 0 && !isActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
            <p className="text-white font-medium mb-1">No suppliers discovered yet</p>
            <p className="text-sm text-slate-500">Click Discover suppliers to search OpenStreetMap for businesses near you.</p>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {scraped.length > 0 && (
            <motion.section key="scraped" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Indexed — {scraped.length} supplier{scraped.length !== 1 ? 's' : ''}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scraped.map((s) => (
                  <LocalSupplierCard key={s.id} supplier={s} onRescrape={handleRescrape} rescraping={rescrapingId === s.id} />
                ))}
              </div>
            </motion.section>
          )}

          {noProduct.length > 0 && (
            <motion.section key="other" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Other nearby — {noProduct.length}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {noProduct.map((s) => (
                  <LocalSupplierCard key={s.id} supplier={s} onRescrape={handleRescrape} rescraping={rescrapingId === s.id} />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {suppliers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex gap-3"
          >
            <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-400/80">
              Suppliers are discovered from OpenStreetMap and ranked by proximity, category match, and your stated priority.
              &ldquo;Contact for quote&rdquo; entries have no scrapable website but remain visible so you keep awareness of your local ecosystem.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  )
}
