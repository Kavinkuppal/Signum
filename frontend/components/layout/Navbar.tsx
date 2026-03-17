'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const links = [
    { href: '/dashboard', label: 'Projects' },
    { href: '/compare', label: 'Compare' },
    { href: '/search', label: 'Search' },
    { href: '/inventory', label: 'Ledger' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#060b18]/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20'
          : 'bg-[#060b18] border-b border-white/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-base font-semibold text-white tracking-tight">
              Signum
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    pathname === link.href
                      ? 'text-white font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {pathname === link.href && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-white/10 rounded-lg"
                      style={{ zIndex: -1 }}
                    />
                  )}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          {session && (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                {session.user?.image ? (
                  <img src={session.user.image} alt="" className="w-7 h-7 rounded-full ring-1 ring-white/20" />
                ) : (
                  <div className="w-7 h-7 bg-blue-600/30 rounded-full flex items-center justify-center text-xs font-medium text-blue-300">
                    {session.user?.name?.[0]}
                  </div>
                )}
                <span className="text-sm text-slate-400">{session.user?.name}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-slate-500 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.nav>
  )
}
