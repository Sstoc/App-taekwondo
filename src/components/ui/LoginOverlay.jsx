import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

export default function LoginOverlay() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser, setProfile } = useAppStore()
  const navigate = useNavigate()

  async function handleLogin() {
    setError('')
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setUser(data.user)

      let currentRole = 'alumno'
      try {
        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', data.user.id).maybeSingle()

        if (email === 'aandres.moreno3@gmail.com' || profile?.role === 'admin') {
          currentRole = 'admin'
          if (!profile || profile.role !== 'admin') {
            await supabase.from('profiles').upsert({ id: data.user.id, role: 'admin' })
          }
        } else if (!profile) {
          await supabase.from('profiles').upsert({ id: data.user.id, role: 'alumno' })
        } else {
          currentRole = profile.role || 'alumno'
        }

        setProfile({ id: data.user.id, role: currentRole, ...(profile || {}) })
      } catch (err) {
        if (email === 'aandres.moreno3@gmail.com') currentRole = 'admin'
        setProfile({ id: data.user.id, role: currentRole })
      }

      if (currentRole === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/portal/status', { replace: true })
      }
    } catch (err) {
      const msgs = {
        'Invalid login credentials': 'Email o contrasena incorrectos.',
        'Email not confirmed': 'Confirma tu email antes de entrar.',
        'User already registered': 'Ya existe una cuenta con ese email.',
      }
      setError(msgs[err.message] || err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      setError('')
      alert('Cuenta creada. Revisa tu email para confirmarla.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Overlay identico al original: bg-slate-950/80 backdrop-blur-md */
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
         style={{ background: 'rgba(2,6,23,0.80)', backdropFilter: 'blur(8px)' }}>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden modal-enter"
      >
        {/* Header: bg-slate-900 identico al original */}
        <div className="p-8 bg-slate-900 text-white text-center">
          <img
            src="/logo chang moo kwan.jpeg"
            alt="Chang Moo Kwan"
            onError={e => {
              e.target.onerror = null
              e.target.src = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='18' fill='%230f172a'/%3E%3Ctext x='48' y='40' font-size='14' text-anchor='middle' fill='%23ffffff' font-family='Arial'%3ECMK%3C/text%3E%3Ctext x='48' y='62' font-size='10' text-anchor='middle' fill='%23cbd5e1' font-family='Arial'%3ETaekwondo%3C/text%3E%3C/svg%3E"
            }}
            className="w-24 h-24 rounded-2xl mx-auto object-cover shadow-lg mb-4 border border-white/20"
          />
          <h2 className="text-2xl font-extrabold">Taekwondo</h2>
          <p className="text-sm text-slate-300 mt-1">CHANG MOO KWAN</p>
        </div>

        {/* Body: identico al original */}
        <div className="p-8 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block ml-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full p-4 pr-24 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition">
                {showPass ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm font-bold text-red-500 text-center bg-red-50 border border-red-200 py-3 px-2 rounded-xl">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={handleLogin} disabled={loading}
              className="py-4 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50 hover:bg-slate-800 transition">
              {loading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Entrar'}
            </button>
            <button onClick={handleRegister} disabled={loading}
              className="py-4 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700 transition">
              Crear cuenta
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
