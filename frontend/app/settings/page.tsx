'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import { apiUrl, api } from '@/lib/api'
import type { UserProfile } from '@/types'

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

const MATERIAL_OPTIONS = [
  'Vinyl', 'Aluminum', 'Substrate', 'LED', 'Hardware',
  'Laminate', 'Acrylic', 'Ink', 'Coroplast', 'Foam Board',
]

const RADIUS_OPTIONS = [
  { value: 25, label: '25 km (15 mi)' },
  { value: 50, label: '50 km (30 mi)' },
  { value: 80, label: '80 km (50 mi) — default' },
  { value: 150, label: '150 km (93 mi)' },
]

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const email = session?.user?.email ?? ''

  // Scrape state
  const [scrapeStatus, setScrapeStatus] = useState<Record<string, any>>({})
  const [scraping, setScraping] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [scrapeStarted, setScrapeStarted] = useState(false)

  // Location profile state
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState(80)
  const [priority, setPriority] = useState<'price' | 'speed' | 'local'>('price')
  const [materialInterests, setMaterialInterests] = useState<string[]>([])
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discoverStarted, setDiscoverStarted] = useState(false)

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

  // Load saved location profile
  useEffect(() => {
    if (!email) return
    api.getLocationProfile(email).then((prof: UserProfile | null) => {
      if (prof) {
        setProfile(prof)
        setLocation(prof.zip_code ?? prof.city ?? '')
        setRadius(prof.search_radius_km)
        setPriority(prof.priority as 'price' | 'speed' | 'local')
        setMaterialInterests(prof.material_interests ?? [])
      }
    }).catch(() => {})
  }, [email])

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

  const toggleMaterial = (cat: string) => {
    setMaterialInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleSaveProfile = async () => {
    if (!email || !location.trim()) return
    setSavingProfile(true)
    try {
      const isZip = /^\d{5}(-\d{4})?$/.test(location.trim())
      const saved = await api.saveLocationProfile(email, {
        zip_code: isZip ? location.trim() : undefined,
        city: !isZip ? location.trim() : undefined,
        search_radius_km: radius,
        priority,
        material_interests: materialInterests,
      })
      setProfile(saved)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } catch {
      alert('Failed to save profile. Check your location and try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleDiscover = async () => {
    if (!email) return
    setDiscovering(true)
    setDiscoverStarted(false)
    try {
      await api.discoverLocalSuppliers(email)
      setDiscoverStarted(true)
      setTimeout(() => setDiscoverStarted(false), 5000)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Discovery failed — save your location first.')
    } finally {
      setDiscovering(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-slate-500 mb-8">Data sources, location, and supplier catalog management.</p>
        </motion.div>

        {/* ── Location Profile ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Location & Preferences</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Used to discover nearby suppliers via OpenStreetMap and rank results by proximity.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-5">
            {/* Location input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Zip code or city
              </label>
              <input
                type="text"
                placeholder="e.g. 30318 or Atlanta, GA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all"
              />
              {profile?.lat && (
                <p className="text-xs text-slate-600 mt-1">
                  Resolved: {profile.lat.toFixed(4)}, {profile.lng?.toFixed(4)}
                </p>
              )}
            </div>

            {/* Search radius */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Search radius
              </label>
              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRadius(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      radius === opt.value
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Ranking priority
              </label>
              <div className="flex gap-2 flex-wrap">
                {(['price', 'speed', 'local'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                      priority === p
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {p === 'price' ? 'Lowest price' : p === 'speed' ? 'Fastest delivery' : 'Local first'}
                  </button>
                ))}
              </div>
            </div>

            {/* Material interests */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Material interests <span className="text-slate-600">(optional — improves ranking)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {MATERIAL_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleMaterial(cat)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      materialInterests.includes(cat)
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                        : 'bg-white/[0.04] border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Save + Discover buttons */}
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSaveProfile}
                disabled={savingProfile || !location.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
              >
                {savingProfile ? 'Saving…' : profileSaved ? '✓ Saved' : 'Save profile'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleDiscover}
                disabled={discovering || !profile?.lat}
                className="bg-white/[0.07] hover:bg-white/[0.1] border border-white/10 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors flex items-center gap-2"
              >
                {discovering ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Starting…
                  </>
                ) : discoverStarted ? '✓ Discovery started' : 'Discover nearby suppliers'}
              </motion.button>

              {discoverStarted && (
                <button
                  onClick={() => router.push('/local-suppliers')}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View results →
                </button>
              )}
            </div>

            {!profile?.lat && location.trim() && (
              <p className="text-xs text-slate-600 -mt-2">
                Save your profile first to geocode the location, then discover suppliers.
              </p>
            )}
          </div>
        </motion.section>

        {/* ── Tier 1 Suppliers ──────────────────────────────────────────────── */}
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

        {/* How it works callout */}
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
            <p className="text-sm font-medium text-blue-300 mb-1">About supplier discovery</p>
            <p className="text-sm text-blue-400/70">
              Tier 1 suppliers (Blue Ridge, McLogan, USCutter) have public catalogs scraped nightly.
              Local suppliers are discovered from OpenStreetMap using your zip code and automatically
              scraped via a smart chain: Shopify API → WooCommerce API → JSON-LD → AI extraction.
              Suppliers without scrapable catalogs appear as &ldquo;contact for quote&rdquo; entries.
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
