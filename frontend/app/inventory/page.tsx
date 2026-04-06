'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/layout/Navbar'
import Link from 'next/link'
import { apiUrl, authHeaders } from '@/lib/api'

interface Entry {
  id: string; project_id: string | null; material_name: string
  supplier_name: string | null; quantity: number; unit: string | null
  unit_price: number | null; total_price: number | null
  purchased_at: string; product_url: string | null
}

export default function InventoryPage() {
  const { data: session } = useSession()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = () => {
    if (!session?.user?.email) return
    fetch(apiUrl('/projects/inventory/ledger'), { headers: authHeaders(session.user.email) })
      .then(r => r.json()).then(setEntries).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { fetchEntries() }, [session])

  const deleteEntry = async (id: string) => {
    await fetch(apiUrl(`/projects/inventory/ledger/${id}`), {
      method: 'DELETE', headers: authHeaders(session?.user?.email)
    })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const totalSpend = entries.reduce((sum, e) => sum + (e.total_price || 0), 0)

  return (
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventory Ledger</h1>
            <p className="text-sm text-gray-500 mt-1">History of all purchased materials</p>
          </div>
          {entries.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Total spent</p>
              <p className="text-2xl font-bold text-white">${totalSpend.toFixed(2)}</p>
            </div>
          )}
        </motion.div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-24 border border-white/10 border-dashed rounded-2xl">
            <p className="text-white font-semibold mb-2">No purchases yet</p>
            <p className="text-gray-500 text-sm mb-6">When you mark items as purchased in a project, they&apos;ll appear here.</p>
            <Link href="/dashboard" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Go to projects →</Link>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-6 py-4 font-medium">Material</th>
                  <th className="text-left px-4 py-4 font-medium">Supplier</th>
                  <th className="text-right px-4 py-4 font-medium">Qty</th>
                  <th className="text-right px-4 py-4 font-medium">Unit Price</th>
                  <th className="text-right px-4 py-4 font-medium">Total</th>
                  <th className="text-right px-6 py-4 font-medium">Date</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry, i) => (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{entry.material_name}</p>
                      {entry.product_url && (
                        <a href={entry.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-400 transition-colors mt-0.5 inline-block">View product →</a>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-400 capitalize">{entry.supplier_name?.replace('_', ' ') || '—'}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-300">{entry.quantity} {entry.unit}</td>
                    <td className="px-4 py-4 text-right text-gray-300">{entry.unit_price ? `$${entry.unit_price.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-4 text-right font-semibold text-white">{entry.total_price ? `$${entry.total_price.toFixed(2)}` : '—'}</td>
                    <td className="px-6 py-4 text-right text-gray-500 text-xs">
                      {new Date(entry.purchased_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-4">
                      <button onClick={() => deleteEntry(entry.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
