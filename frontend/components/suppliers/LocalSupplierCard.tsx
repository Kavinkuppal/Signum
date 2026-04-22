'use client'

import { motion } from 'framer-motion'
import type { LocalSupplier } from '@/types'

interface Props {
  supplier: LocalSupplier
  onRescrape?: (id: string) => void
  rescraping?: boolean
}

const STATUS_CONFIG = {
  scraped: {
    dot: 'bg-green-500',
    text: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    label: 'Products found',
  },
  scraping: {
    dot: 'bg-blue-400 animate-pulse',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    label: 'Scraping…',
  },
  pending: {
    dot: 'bg-yellow-400 animate-pulse',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    label: 'Queued',
  },
  failed: {
    dot: 'bg-red-500',
    text: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    label: 'Scrape failed',
  },
  no_website: {
    dot: 'bg-slate-500',
    text: 'text-slate-400',
    bg: 'bg-white/[0.03] border-white/10',
    label: 'Contact for quote',
  },
  login_required: {
    dot: 'bg-orange-400',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    label: 'Login required',
  },
} as const

export default function LocalSupplierCard({ supplier, onRescrape, rescraping }: Props) {
  const cfg = STATUS_CONFIG[supplier.scrape_status] ?? STATUS_CONFIG.failed
  const osmUrl = supplier.lat && supplier.lng
    ? `https://www.openstreetmap.org/?mlat=${supplier.lat}&mlon=${supplier.lng}#map=17/${supplier.lat}/${supplier.lng}`
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 flex flex-col gap-3 ${cfg.bg}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
            <h3 className="font-semibold text-white text-sm truncate">{supplier.name}</h3>
            {supplier.distance_km != null && (
              <span className="text-xs text-slate-500 shrink-0">
                {supplier.distance_km < 1
                  ? `${Math.round(supplier.distance_km * 1000)} m`
                  : `${supplier.distance_km.toFixed(1)} km`}
              </span>
            )}
          </div>

          {/* Status badge */}
          <span className={`inline-block text-xs font-medium ${cfg.text} mt-0.5`}>
            {supplier.scrape_status === 'scraped'
              ? `${supplier.products_found.toLocaleString()} products indexed`
              : cfg.label}
          </span>
        </div>

        {/* Rank badge */}
        {supplier.rank_score != null && (
          <div className="shrink-0 text-right">
            <span className="text-xs text-slate-600">Score</span>
            <div className="text-sm font-semibold text-white">{Math.round(supplier.rank_score)}</div>
          </div>
        )}
      </div>

      {/* Address + contact */}
      <div className="space-y-1 text-xs text-slate-500">
        {supplier.address && (
          <div className="flex items-start gap-1.5">
            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{supplier.address}</span>
          </div>
        )}
        {supplier.phone && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <a href={`tel:${supplier.phone}`} className="hover:text-white transition-colors">
              {supplier.phone}
            </a>
          </div>
        )}
      </div>

      {/* Category tags */}
      {supplier.material_categories && supplier.material_categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {supplier.material_categories.map((cat) => (
            <span
              key={cat}
              className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 border border-white/10"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Error message */}
      {supplier.scrape_status === 'failed' && supplier.scrape_error && (
        <p className="text-xs text-red-400/70 italic line-clamp-2">{supplier.scrape_error}</p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {supplier.scrape_status === 'scraped' && (
          <a
            href={`/search?supplier=${encodeURIComponent(supplier.name.toLowerCase())}`}
            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            View products →
          </a>
        )}

        {supplier.website && (
          <a
            href={supplier.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {new URL(supplier.website).hostname.replace('www.', '')}
          </a>
        )}

        {osmUrl && !supplier.website && (
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            View on map ↗
          </a>
        )}

        {/* Re-scrape button for failed/scraped */}
        {(supplier.scrape_status === 'failed' || supplier.scrape_status === 'scraped') &&
          supplier.website && onRescrape && (
          <button
            onClick={() => onRescrape(supplier.id)}
            disabled={rescraping}
            className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40"
          >
            {rescraping ? 'Re-scraping…' : 'Re-scrape'}
          </button>
        )}
      </div>
    </motion.div>
  )
}
