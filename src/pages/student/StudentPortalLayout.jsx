import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

const NAV = [
  { to: '/portal/status',     icon: 'fa-house',          label: 'Mi estado' },
  { to: '/portal/payments',   icon: 'fa-receipt',        label: 'Mis pagos' },
  { to: '/portal/exam',       icon: 'fa-graduation-cap', label: 'Examen' },
  { to: '/portal/attendance', icon: 'fa-calendar-check', label: 'Asistencia' },
  { to: '/portal/schedule',   icon: 'fa-clock',          label: 'Horarios' },
]

export default function StudentPortalLayout() {
  const navigate = useNavigate()
  const { user, myStudent, showToast } = useAppStore()

  async function handleSignOut() {
    await supabase.auth.signOut()
    showToast('Sesión cerrada')
    navigate('/login')
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0f172a 70%, #1a0a2e 100%)' }}>

      {/* Header */}
      <header className="portal-glass border-b px-5 py-4 flex items-center justify-between shrink-0 z-20"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <img src="/logo chang moo kwan.jpeg" alt="CMK"
            onError={e => { e.target.onerror=null; e.target.style.display='none' }}
            className="w-9 h-9 rounded-xl object-cover border border-white/20 shadow" />
          <div>
            <h1 className="text-sm font-extrabold text-white leading-tight">Chang Moo Kwan</h1>
            {myStudent && <p className="text-[11px] text-slate-400 font-medium truncate max-w-40">{myStudent.name}</p>}
          </div>
        </div>
        <button onClick={handleSignOut}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
        >
          <i className="fa-solid fa-right-from-bracket text-slate-400 text-sm" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto min-h-0 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-full"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Bottom Nav flotante */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        <nav className="flex items-center gap-1 px-3 py-2 rounded-2xl"
             style={{
               background: 'rgba(20, 30, 60, 0.65)',
               backdropFilter: 'blur(28px) saturate(180%)',
               border: '1px solid rgba(255,255,255,0.07)',
               boxShadow: '0 16px 48px rgba(0,0,0,0.40)'
             }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`
              }
              style={({ isActive }) => isActive ? { background: 'rgba(99,102,241,0.25)' } : {}}
            >
              <i className={`fa-solid ${icon} text-base`} />
              <span className="text-[8px] font-bold uppercase tracking-wide">{label}</span>
            </NavLink>
          ))}
          <button onClick={handleSignOut}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-slate-500 hover:text-red-400 transition-all">
            <i className="fa-solid fa-right-from-bracket text-base" />
            <span className="text-[8px] font-bold uppercase tracking-wide">Salir</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
