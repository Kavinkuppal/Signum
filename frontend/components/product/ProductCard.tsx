'use client'

import { motion } from 'framer-motion'
import type { Product } from '@/types'

interface ProductCardProps {
  product: Product
  onClick?: () => void
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, borderColor: 'rgba(59,130,246,0.25)' }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`bg-white/[0.03] rounded-2xl border border-white/10 p-5 flex flex-col gap-3 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-white text-sm leading-snug line-clamp-2 flex-1">
          {product.title}
        </h3>
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
          product.in_stock
            ? 'bg-green-500/15 text-green-400'
            : 'bg-red-500/15 text-red-400'
        }`}>
          {product.in_stock ? 'In stock' : 'Out of stock'}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="bg-white/[0.06] text-slate-300 text-xs px-2.5 py-1 rounded-full font-medium">
          {product.supplier_name}
        </span>
        {product.brand && (
          <span className="bg-white/[0.04] text-slate-400 text-xs px-2.5 py-1 rounded-full">
            {product.brand}
          </span>
        )}
        {product.material_category && (
          <span className="bg-blue-500/15 text-blue-400 text-xs px-2.5 py-1 rounded-full">
            {product.material_category}
          </span>
        )}
      </div>

      {product.sku && (
        <p className="text-xs text-slate-600 font-mono">SKU: {product.sku}</p>
      )}

      {/* Price */}
      <div className="mt-auto pt-3 border-t border-white/5 flex items-end justify-between">
        <div>
          <p className="text-xl font-bold text-white">${product.price.toFixed(2)}</p>
          {product.normalized_price && (
            <p className="text-xs text-slate-500 mt-0.5">
              ${product.normalized_price.toFixed(2)} / {product.normalized_unit}
            </p>
          )}
        </div>
        <motion.a
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          href={product.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-xl font-medium transition-colors"
        >
          Buy →
        </motion.a>
      </div>

      <p className="text-xs text-slate-700">
        Updated {new Date(product.last_scraped_at).toLocaleDateString()}
      </p>
    </motion.div>
  )
}
