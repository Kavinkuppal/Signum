'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import AutocompleteInput from './AutocompleteInput'
import { apiUrl, authHeaders } from '@/lib/api'

interface MaterialRow {
  id: string
  material_name: string
  quantity: string
  unit: string
}

interface Props {
  onClose: () => void
  onCreated: (projectId: string) => void
}

const UNITS = ['rolls', 'sheets', 'units', 'ft', 'ft²', 'lbs', 'boxes', 'packs']

export default function NewProjectModal({ onClose, onCreated }: Props) {
  const { data: session } = useSession()
  const email = session?.user?.email
  const [step, setStep] = useState<'name' | 'materials' | 'loading' | 'review'>('name')
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [materials, setMaterials] = useState<MaterialRow[]>([
    { id: '1', material_name: '', quantity: '1', unit: 'rolls' }
  ])
  const [bom, setBom] = useState<any>(null)
  const [error, setError] = useState('')

  const addRow = () => {
    setMaterials(prev => [...prev, { id: Date.now().toString(), material_name: '', quantity: '1', unit: 'units' }])
  }

  const removeRow = (id: string) => {
    if (materials.length > 1) setMaterials(prev => prev.filter(m => m.id !== id))
  }

  const updateRow = (id: string, field: keyof MaterialRow, value: string) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const handleCreate = async () => {
    if (!projectName.trim()) return setError('Project name is required')
    const validMaterials = materials.filter(m => m.material_name.trim())
    if (!validMaterials.length) return setError('Add at least one material')

    setStep('loading')
    setError('')

    try {
      const res = await fetch(apiUrl('/projects'), {
        method: 'POST',
        headers: authHeaders(email),
        body: JSON.stringify({
          name: projectName.trim(),
          description: description.trim() || null,
          items: validMaterials.map(m => ({
            material_name: m.material_name.trim(),
            quantity: parseFloat(m.quantity) || 1,
            unit: m.unit,
          }))
        })
      })
      const project = await res.json()

      const bomRes = await fetch(apiUrl(`/projects/${project.id}/bom`), { headers: authHeaders(email) })
      const bomData = await bomRes.json()
      setBom({ ...bomData, projectName: projectName.trim() })
      setStep('review')
    } catch (e) {
      setError('Failed to create project. Is the backend running?')
      setStep('materials')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative bg-[#0d1224] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">New Project</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'name' && 'Name your project'}
              {step === 'materials' && 'Add materials needed'}
              {step === 'loading' && 'Finding best prices...'}
              {step === 'review' && 'Review your bill of materials'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 px-7 pt-5">
          {['name', 'materials', 'review'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                step === s ? 'bg-blue-500' :
                ['name', 'materials', 'review'].indexOf(step) > i ? 'bg-blue-500/40' : 'bg-white/10'
              }`} />
              {i < 2 && <div className="w-8 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          <AnimatePresence mode="wait">

            {/* Step 1: Name */}
            {step === 'name' && (
              <motion.div key="name" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Project Name *</label>
                  <input
                    autoFocus
                    type="text"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && projectName.trim() && setStep('materials')}
                    placeholder="e.g. Joe's Pizza Storefront"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Description <span className="text-gray-600">(optional)</span></label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief notes about this project..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-sm resize-none"
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </motion.div>
            )}

            {/* Step 2: Materials */}
            {step === 'materials' && (
              <motion.div key="materials" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2 mb-2">
                  <span className="text-xs text-gray-500 font-medium">Material</span>
                  <span className="text-xs text-gray-500 font-medium">Qty</span>
                  <span className="text-xs text-gray-500 font-medium">Unit</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {materials.map((row, i) => (
                    <motion.div
                      key={row.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                      className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center"
                    >
                      <AutocompleteInput
                        value={row.material_name}
                        onChange={val => updateRow(row.id, 'material_name', val)}
                        placeholder="e.g. White vinyl, Aluminum blank..."
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-sm w-full"
                      />
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={row.quantity}
                        onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 text-sm w-full"
                      />
                      <select
                        value={row.unit}
                        onChange={e => updateRow(row.id, 'unit', e.target.value)}
                        className="bg-[#0d1224] border border-white/10 rounded-xl px-2 py-2.5 text-white focus:outline-none focus:border-blue-500/50 text-sm w-full"
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button onClick={() => removeRow(row.id)} className="text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </motion.div>
                  ))}
                </div>
                <button onClick={addRow} className="mt-3 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add material
                </button>
                {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
              </motion.div>
            )}

            {/* Loading */}
            {step === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Searching {'>'}2,000 products across suppliers...</p>
              </motion.div>
            )}

            {/* Step 3: Review BOM */}
            {step === 'review' && bom && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                <div className="space-y-3">
                  {bom.matches.map((match: any, i: number) => (
                    <motion.div
                      key={match.item_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.06 }}
                      className="bg-white/[0.03] border border-white/10 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wider">{match.material_name} × {match.quantity} {match.unit}</p>
                          {match.best_match ? (
                            <>
                              <p className="text-sm font-semibold text-white line-clamp-1">{match.best_match.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full capitalize">{match.best_match.supplier_name}</span>
                                {match.best_match.material_category && (
                                  <span className="text-xs text-gray-600">{match.best_match.material_category}</span>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No match found — you can search manually</p>
                          )}
                        </div>
                        {match.estimated_price && (
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-white">${match.estimated_price.toFixed(2)}</p>
                            {match.best_match?.normalized_price && (
                              <p className="text-xs text-gray-500">${match.best_match.normalized_price.toFixed(3)}/{match.best_match.normalized_unit}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Estimated total</p>
                    <p className="text-2xl font-bold text-white">${bom.total_estimated.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-gray-600 max-w-xs text-right">Prices pulled from live supplier data. Final costs may vary.</p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-white/10 flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Cancel
          </button>
          <div className="flex gap-3">
            {step === 'materials' && (
              <button onClick={() => setStep('name')} className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
                Back
              </button>
            )}
            {step === 'name' && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { if (!projectName.trim()) return setError('Project name is required'); setError(''); setStep('materials') }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Next →
              </motion.button>
            )}
            {step === 'materials' && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleCreate}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Find Best Prices
              </motion.button>
            )}
            {step === 'review' && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { onCreated(bom.project_id) }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Open Project →
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
