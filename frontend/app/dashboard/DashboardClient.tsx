'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import NewProjectModal from '@/components/project/NewProjectModal'
import { apiUrl, authHeaders } from '@/lib/api'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  items: { id: string; staged: boolean; purchased: boolean }[]
}

export default function DashboardClient({ user }: { user: any }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = async () => {
    try {
      const res = await fetch(apiUrl('/projects'), { headers: authHeaders(user?.email) })
      const data = await res.json()
      setProjects(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProjects() }, [])

  const handleCreated = (projectId: string) => {
    setShowModal(false)
    router.push(`/projects/${projectId}`)
  }

  return (
    <div className="min-h-screen bg-[#060b18]">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            {user?.image && <img src={user.image} alt="" className="w-10 h-10 rounded-full ring-2 ring-white/10" />}
            <div>
              <h1 className="text-2xl font-bold text-white">
                {user?.name ? `Good to see you, ${user.name.split(' ')[0]}` : 'Dashboard'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/search" className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-4 py-2.5 rounded-xl transition-all duration-200">
              Quick search
            </Link>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Project
            </motion.button>
          </div>
        </motion.div>

        {/* Projects */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2].map(i => <div key={i} className="h-32 bg-white/[0.03] rounded-2xl border border-white/10 animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center py-24 border border-white/10 border-dashed rounded-2xl"
          >
            <div className="w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-2">No projects yet</p>
            <p className="text-gray-500 text-sm mb-6">Create a project to find the best prices for your materials.</p>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create your first project
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {projects.map((project) => {
              const total = project.items.length
              const staged = project.items.filter(i => i.staged && !i.purchased).length
              const purchased = project.items.filter(i => i.purchased).length
              return (
                <motion.div
                  key={project.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.4 }}
                >
                  <Link href={`/projects/${project.id}`}>
                    <motion.div
                      whileHover={{ scale: 1.01, borderColor: 'rgba(59,130,246,0.3)' }}
                      transition={{ duration: 0.2 }}
                      className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-white text-base">{project.name}</h3>
                          {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
                        </div>
                        <svg className="w-5 h-5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500">{total} materials</span>
                        {staged > 0 && <span className="bg-yellow-500/15 text-yellow-400 px-2 py-1 rounded-full font-medium">{staged} ready to buy</span>}
                        {purchased > 0 && <span className="bg-green-500/15 text-green-400 px-2 py-1 rounded-full font-medium">{purchased} purchased</span>}
                      </div>
                      <p className="text-xs text-gray-600 mt-3">{new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </motion.div>
                  </Link>
                </motion.div>
              )
            })}

            {/* Add new project card */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.4 }}
            >
              <motion.button
                whileHover={{ scale: 1.01, borderColor: 'rgba(59,130,246,0.3)' }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setShowModal(true)}
                transition={{ duration: 0.2 }}
                className="w-full border border-white/10 border-dashed rounded-2xl p-6 flex items-center justify-center gap-3 text-gray-500 hover:text-blue-400 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="text-sm font-medium">New project</span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {showModal && <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      </AnimatePresence>
    </div>
  )
}
