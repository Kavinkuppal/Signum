'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'

/* ─── Helpers ─────────────────────────────────────────────────── */

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── Data ────────────────────────────────────────────────────── */

const HERO_BENEFITS = [
  'Search Blue Ridge, McLogan, and USCutter in one place',
  'Normalized pricing — $/ft², $/unit, $/linear ft — across all suppliers',
  'Click-to-buy links go directly to supplier pages, no middleman',
]

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: 'Multi-Supplier Search',
    desc: 'Search across all connected suppliers simultaneously. One query, every result.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 20h16a2 2 0 002-2V8a2 2 0 00-2-2h-5L13 4H9L7 6H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Normalized Pricing',
    desc: 'Every price converted to $/ft², $/unit, or $/linear ft so you can compare across pack sizes.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Live Availability',
    desc: 'In-stock status refreshed daily. Every product card shows exactly when it was last updated.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
      </svg>
    ),
    title: 'Advanced Filters',
    desc: 'Filter by material category, brand, dimensions, finish, price range, and availability.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    title: 'Volume Discount Alerts',
    desc: 'Automatically flags when buying a few more units drops your per-unit cost significantly.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Price History',
    desc: 'Track pricing trends per SKU over time. Know when to buy at the right moment.',
  },
]

const STATS = [
  { value: '$16B+', label: 'US signage industry' },
  { value: '5,900+', label: 'Sign shops nationwide' },
  { value: '73%', label: 'Shops with fewer than 10 employees' },
  { value: '8 hrs+', label: 'Wasted weekly on procurement' },
]

const SUPPLIERS = [
  { name: 'Blue Ridge Sign Supply', domain: 'blueridgesignsupply.com', desc: 'Aluminum blanks, substrates, vinyl, hardware', initial: 'BR' },
  { name: 'McLogan Supply', domain: 'mclogan.com', desc: 'Vinyl, heat transfer, wide format media', initial: 'ML' },
  { name: 'USCutter', domain: 'uscutter.com', desc: 'Sign vinyl, printable media, laminates', initial: 'UC' },
]

const STEPS = [
  { n: '01', title: 'Sign in with Google', desc: 'Create your account in seconds. No credit card required.' },
  { n: '02', title: 'Catalog auto-imports', desc: 'Signum scrapes all three suppliers daily and normalizes every price into a unified database.' },
  { n: '03', title: 'Search & compare', desc: 'Search across all suppliers at once. Filter by material, price, and availability.' },
  { n: '04', title: 'Click to buy', desc: "Every result links directly to the supplier's product page. We never touch your order." },
]

const FAQS = [
  {
    q: 'Which suppliers are included?',
    a: 'Blue Ridge Sign Supply, McLogan Supply, and USCutter are fully integrated with daily automated scraping. These are all public-pricing suppliers — no account needed on your end.',
  },
  {
    q: 'How often is pricing updated?',
    a: 'All three supplier catalogs are scraped every day at 2am. Every product card shows its last-updated timestamp so you always know how fresh the data is.',
  },
  {
    q: 'Does Signum process payments?',
    a: "No. The \"Buy\" button takes you directly to the supplier's product page where you complete the purchase through their own checkout. We never handle payments.",
  },
  {
    q: 'What materials are covered?',
    a: 'Vinyl (cast, calendered, wrap, heat transfer), aluminum sign blanks, PVC substrates, coroplast, foam board, laminates, acrylic, LED components, hardware, and inks.',
  },
  {
    q: 'Is this only for large shops?',
    a: 'Signum is built specifically for small sign shops — the 73% of the industry with 1–9 employees who currently do procurement manually with spreadsheets.',
  },
  {
    q: 'What is normalized pricing?',
    a: "Raw prices alone are misleading — a 54\" × 50yd roll vs a 24\" × 10yd roll can't be compared directly. Signum converts every price to $/ft² (or $/unit for hardware, $/linear ft for trim) so you always know the true cost.",
  },
]

/* ─── Navbar ──────────────────────────────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-[#060b18]/90 backdrop-blur-xl border-b border-white/10' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-xl font-bold text-white tracking-tight">Signum</span>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Suppliers', 'FAQ'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-gray-400 hover:text-white transition-colors duration-200">
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors duration-200 px-3 py-2">
            Sign in
          </Link>
          <Link href="/login" className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg transition-colors duration-200">
            Get started
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}

/* ─── Hero ────────────────────────────────────────────────────── */

function Hero() {
  const comparisonRows = [
    { supplier: 'Blue Ridge', product: 'Aluminum Blank 4×8 .040"', price: '$38.50', unit: '$0.10/ft²', best: false },
    { supplier: 'McLogan', product: 'Alum Sign Blank 48×96 White', price: '$34.00', unit: '$0.09/ft²', best: true },
    { supplier: 'USCutter', product: '4×8 Aluminum Sheet White', price: '$42.00', unit: '$0.11/ft²', best: false },
  ]

  return (
    <section className="relative min-h-screen flex items-center bg-[#060b18] overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[400px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium px-4 py-2 rounded-full mb-8"
            >
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Built for sign shops — Georgia Tech CREATE-X
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl md:text-6xl font-bold text-white leading-[1.08] tracking-tight mb-6"
            >
              Improve the Way<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                You Buy Sign Materials
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-lg text-gray-400 mb-8 leading-relaxed"
            >
              Signum aggregates supplier catalogs into one procurement platform.
              Compare prices, track availability, and buy smarter — without the spreadsheets.
            </motion.p>

            <div className="space-y-3 mb-10">
              {HERO_BENEFITS.map((b, i) => (
                <motion.div
                  key={b}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300 text-sm leading-relaxed">{b}</span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98]"
              >
                Start for free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-gray-300 hover:text-white font-medium px-8 py-4 rounded-xl transition-all duration-200"
              >
                View dashboard
              </Link>
            </motion.div>
          </div>

          {/* Right — comparison card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <div className="bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live comparison</span>
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3 font-medium">Aluminum Sign Blank 4×8</p>
              <div className="space-y-2">
                {comparisonRows.map((row, i) => (
                  <motion.div
                    key={row.supplier}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.8 + i * 0.15 }}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                      row.best ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/[0.03]'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${row.best ? 'text-white' : 'text-gray-300'}`}>{row.supplier}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{row.product}</p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className={`text-sm font-bold ${row.best ? 'text-blue-400' : 'text-gray-300'}`}>{row.price}</p>
                      <p className="text-xs text-gray-500">{row.unit}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.3 }}
                className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center"
              >
                <p className="text-sm text-emerald-400 font-semibold">McLogan saves you $8/sheet</p>
                <p className="text-xs text-gray-500 mt-0.5">on 4×8 aluminum blanks</p>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}

/* ─── Stats ───────────────────────────────────────────────────── */

function StatsBar() {
  return (
    <section className="bg-[#0a0f1e] border-y border-white/10 py-14">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {STATS.map((s, i) => (
            <FadeUp key={s.label} delay={i * 0.08} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white mb-1.5">{s.value}</p>
              <p className="text-sm text-gray-500 leading-snug">{s.label}</p>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Suppliers ───────────────────────────────────────────────── */

function SuppliersSection() {
  return (
    <section id="suppliers" className="bg-[#060b18] py-24 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6">
        <FadeUp className="text-center mb-14">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Integrated Suppliers</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Your suppliers, all in one place</h2>
          <p className="text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
            Signum scrapes all three suppliers daily. Pricing is always fresh — no account needed on your end.
          </p>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SUPPLIERS.map((s, i) => (
            <FadeUp key={s.name} delay={i * 0.12}>
              <motion.div
                whileHover={{ scale: 1.02, borderColor: 'rgba(59,130,246,0.3)' }}
                transition={{ duration: 0.2 }}
                className="border border-white/10 bg-white/[0.03] rounded-2xl p-7 text-center cursor-default"
              >
                <div className="w-12 h-12 bg-blue-500/15 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-sm font-bold text-blue-400">{s.initial}</span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{s.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{s.domain}</p>
                <p className="text-xs text-gray-600">{s.desc}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Features ────────────────────────────────────────────────── */

function FeaturesSection() {
  return (
    <section id="features" className="bg-[#0a0f1e] py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeUp className="text-center mb-16">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Platform Capabilities</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Everything your procurement needs</h2>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <FadeUp key={f.title} delay={i * 0.07}>
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 rounded-2xl p-6 h-full transition-colors duration-200"
              >
                <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white mb-2 text-sm">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── How It Works ────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section className="bg-[#060b18] py-24 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6">
        <FadeUp className="text-center mb-16">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Up and running in minutes</h2>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((s, i) => (
            <FadeUp key={s.n} delay={i * 0.1}>
              <div className="relative">
                <div className="text-6xl font-black mb-4 leading-none select-none" style={{ color: 'rgba(255,255,255,0.06)' }}>
                  {s.n}
                </div>
                <h3 className="font-semibold text-white mb-2 text-sm">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── FAQ ─────────────────────────────────────────────────────── */

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-[#0a0f1e] py-24 border-t border-white/10">
      <div className="max-w-2xl mx-auto px-6">
        <FadeUp className="text-center mb-14">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Common questions</h2>
        </FadeUp>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <FadeUp key={i} delay={i * 0.04}>
              <div className="border border-white/10 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.03] transition-colors duration-200"
                >
                  <span className="font-medium text-white text-sm pr-6">{faq.q}</span>
                  <motion.span
                    animate={{ rotate: open === i ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 text-gray-500 text-xl leading-none font-light"
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-5 text-sm text-gray-400 leading-relaxed border-t border-white/10 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA ─────────────────────────────────────────────────────── */

function CTASection() {
  return (
    <section className="bg-[#060b18] py-28 border-t border-white/10 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[700px] h-[300px] bg-blue-600/10 rounded-full blur-[100px]" />
      </div>
      <div className="relative max-w-2xl mx-auto px-6 text-center">
        <FadeUp>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight leading-tight">
            Stop wasting hours<br />on procurement.
          </h2>
          <p className="text-gray-400 mb-10 text-lg">
            Join sign shops already using Signum to compare supplier pricing and buy smarter.
          </p>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-12 py-4 rounded-xl transition-colors duration-200 hover:shadow-xl hover:shadow-blue-600/25 text-base"
            >
              Get started for free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </motion.div>
        </FadeUp>
      </div>
    </section>
  )
}

/* ─── Footer ──────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-[#040810] border-t border-white/10 py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-white font-bold">Signum</span>
          <p className="text-gray-600 text-xs mt-1">Signage Procurement Pro</p>
        </div>
        <p className="text-gray-600 text-sm">Georgia Tech CREATE-X · Team 13 · 2026</p>
        <div className="flex gap-6">
          <Link href="/login" className="text-gray-500 hover:text-gray-300 text-sm transition-colors duration-200">Sign in</Link>
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm transition-colors duration-200">Dashboard</Link>
          <Link href="/search" className="text-gray-500 hover:text-gray-300 text-sm transition-colors duration-200">Search</Link>
        </div>
      </div>
    </footer>
  )
}

/* ─── Page ────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="bg-[#060b18]">
      <Navbar />
      <Hero />
      <StatsBar />
      <SuppliersSection />
      <FeaturesSection />
      <HowItWorks />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  )
}
