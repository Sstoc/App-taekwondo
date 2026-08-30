import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

const NAV = [
  { to: '/admin/dashboard', icon: 'fa-chart-pie',         label: 'General' },
  { to: '/admin/students',  icon: 'fa-users',             label: 'Alumnos' },
  { to: '/admin/attendance',icon: 'fa-clipboard-check',   label: 'Asistencia' },
  { to: '/admin/history',   icon: 'fa-clock-rotate-left', label: 'Historial' },
  { to: '/admin/exams',     icon: 'fa-graduation-cap',    label: 'Examen' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const { user, showToast } = useAppStore()

  async function handleSignOut() {
    await supabase.auth.signOut()
    showToast('Sesión cerrada')
    navigate('/login')
  }

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col md:flex-row relative">

      {/* SIDEBAR DESKTOP — igual al original: glass, w-72, p-6 */}
      <aside className="hidden md:flex w-72 flex-col justify-between p-6 z-20 shrink-0 glass">
        <div>
          <div className="flex items-center gap-3 mb-10 text-indigo-700">
            <img src="/logo chang moo kwan.jpeg" alt="CMK Logo"
              onError={e => {
                e.target.onerror=null
                e.target.src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='10' fill='%230f172a'/%3E%3Ctext x='20' y='25' font-size='14' text-anchor='middle' fill='%23ffffff' font-family='Arial'%3ECMK%3C/text%3E%3C/svg%3E"
              }}
              className="w-10 h-10 rounded-xl object-cover shadow-lg border border-slate-200"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Taekwondo</h1>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CHANG MOO KWAN</p>
            </div>
          </div>

          {/* Nav — activo: bg-indigo-50 text-indigo-700 translate-x-2 (igual al original) */}
          <nav className="space-y-2">
            {NAV.map(({ to, icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 translate-x-2'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`
                }
              >
                <i className={`fa-solid ${icon} w-5`} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <div className="border-t border-slate-200 pt-4 mt-4">
            <p className="text-xs text-slate-500 font-semibold truncate px-1 mb-2">{user?.email}</p>
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-300">
              <i className="fa-solid fa-right-from-bracket w-5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto min-h-0 pb-28 md:pb-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-full page-enter"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* NAV MOBILE FLOTANTE — pill, glass, fixed bottom (igual al original) */}
      <nav className="md:hidden fixed bottom-4 left-0 right-0 mx-4 z-[100] glass flex justify-around py-3 px-4 rounded-2xl"
           style={{ boxShadow: '0 16px 48px rgba(99,102,241,0.18), 0 4px 16px rgba(0,0,0,0.08)' }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-all duration-200 relative px-3 py-1 ${
                isActive ? 'text-indigo-600' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-200 ${isActive ? 'bg-indigo-50' : ''}`}>
                  <i className={`fa-solid ${icon} text-xl`} />
                </div>
              </>
            )}
          </NavLink>
        ))}
        <button onClick={handleSignOut}
          className="flex flex-col items-center gap-1 transition-all duration-200 px-3 py-1 text-slate-400 hover:text-red-500">
          <div className="w-10 h-10 flex items-center justify-center rounded-2xl">
            <i className="fa-solid fa-right-from-bracket text-xl" />
          </div>
        </button>
      </nav>
    </div>
  )
}
