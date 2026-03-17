'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { Product } from '@/types'

interface Props {
  product: Product | null
  onClose: () => void
}

const SUPPLIER_COLORS: Record<string, string> = {
  blue_ridge: 'bg-blue-500/15 text-blue-400',
  mclogan:    'bg-purple-500/15 text-purple-400',
  uscutter:   'bg-orange-500/15 text-orange-400',
  grimco:     'bg-red-500/15 text-red-400',
  fellers:    'bg-cyan-500/15 text-cyan-400',
  glantz:     'bg-green-500/15 text-green-400',
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/[0.06] last:border-0">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider shrink-0 w-28">{label}</span>
      <span className="text-sm text-slate-300 text-right">{value}</span>
    </div>
  )
}

export default function ProductDetailModal({ product, onClose }: Props) {
  if (!product) return null

  const dimParts = []
  if (product.dimensions_width) dimParts.push(`${product.dimensions_width}"W`)
  if (product.dimensions_length) dimParts.push(`${(product.dimensions_length / 12).toFixed(1)}'L`)
  if (product.dimensions_thickness) dimParts.push(`${product.dimensions_thickness}mm thick`)
  const dimensions = dimParts.join(' × ') || null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full sm:max-w-2xl bg-[#0d1224] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="overflow-y-auto flex-1">
            {/* Image */}
            <div className="w-full h-52 sm:h-64 bg-white/[0.03] border-b border-white/10 flex items-center justify-center overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.title}
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-30">
                  <svg className="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-slate-500">No image available</p>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${SUPPLIER_COLORS[product.supplier_name] || 'bg-white/[0.06] text-slate-400'}`}>
                    {product.supplier_name.replace('_', ' ')}
                  </span>
                  {product.material_category && (
                    <span className="text-xs bg-white/[0.06] text-slate-400 px-2.5 py-1 rounded-full">
                      {product.material_category}
                    </span>
                  )}
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ml-auto ${product.in_stock ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {product.in_stock ? 'In stock' : 'Out of stock'}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white leading-snug">{product.title}</h2>
              </div>

              {/* Pricing */}
              <div className="flex items-end gap-4 mb-5 pb-5 border-b border-white/10">
                <div>
                  <p className="text-3xl font-bold text-white">${product.price.toFixed(2)}</p>
                  {product.pack_quantity && product.pack_quantity > 1 && (
                    <p className="text-xs text-slate-500 mt-0.5">pack of {product.pack_quantity} · ${(product.price / product.pack_quantity).toFixed(2)}/ea</p>
                  )}
                </div>
                {product.normalized_price && (
                  <div className="mb-1">
                    <p className="text-sm text-slate-400 font-medium">
                      ${product.normalized_price.toFixed(3)}
                      <span className="text-slate-600 font-normal">/{product.normalized_unit}</span>
                    </p>
                    <p className="text-xs text-slate-600">normalized cost</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-4">{product.description}</p>
                </div>
              )}

              {/* Specs table */}
              <div className="mb-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Specifications</p>
                <DetailRow label="SKU" value={<span className="font-mono text-xs">{product.sku}</span>} />
                <DetailRow label="Brand" value={product.brand} />
                <DetailRow label="Dimensions" value={dimensions} />
                <DetailRow label="Color" value={product.color} />
                <DetailRow label="Finish" value={product.finish} />
                <DetailRow label="Pack Qty" value={product.pack_quantity ? `${product.pack_quantity} units` : null} />
                <DetailRow label="Lead Time" value={product.lead_time_days ? `${product.lead_time_days} days` : null} />
                <DetailRow label="Last Updated" value={new Date(product.last_scraped_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 flex gap-3">
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors text-center flex items-center justify-center gap-2"
            >
              Buy on {product.supplier_name.replace('_', ' ')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
