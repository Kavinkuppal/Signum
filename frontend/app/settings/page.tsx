'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import { apiUrl } from '@/lib/api'

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

export default function SettingsPage() {
  const { status: authStatus } = useSession()
  const router = useRouter()
  const [scrapeStatus, setScrapeStatus] = useState<Record<string, any>>({})
  const [scraping, setScraping] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [scrapeStarted, setScrapeStarted] = useState(false)

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
  }, [authStatus, router])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('apiUrl('/scrape/status')')
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
      await fetch('apiUrl('/scrape/run/all')', { method: 'POST' })
      setScrapeStarted(true)
      // Poll status after a moment
      setTimeout(async () => {
        try {
          const res = await fetch('apiUrl('/scrape/status')')
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
      await fetch('apiUrl('/demo/seed')', { method: 'POST' })
      setSeeded(true)
      setTimeout(() => setSeeded(false), 3000)
    } catch {}
    finally { setSeeding(false) }
  }

  return (
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-slate-500 mb-8">Data sources and supplier catalog management.</p>
        </motion.div>

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
