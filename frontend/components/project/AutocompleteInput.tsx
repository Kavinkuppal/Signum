'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiUrl } from '@/lib/api'

interface Suggestion {
  title: string
  category: string | null
}

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function AutocompleteInput({ value, onChange, placeholder, className }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl('/products/autocomplete')}?q=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json()
      setSuggestions(data)
      setOpen(data.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!focused) return
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value, focused, fetchSuggestions])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (s: Suggestion) => {
    onChange(s.title)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { setFocused(true); if (suggestions.length > 0) setOpen(true) }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={className}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0d1224] border border-white/15 rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={() => handleSelect(s)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-left"
              >
                <span className="text-sm text-white truncate">{s.title}</span>
                {s.category && (
                  <span className="text-xs text-slate-600 ml-2 shrink-0">{s.category}</span>
                )}
              </button>
            ))}
            <div className="px-3 py-2 border-t border-white/[0.06]">
              <p className="text-xs text-slate-600">We'll find the best price across all suppliers</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
