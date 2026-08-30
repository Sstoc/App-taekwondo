import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

const RANK_ORDER = ['Blanco','Amarillo','Amarillo Int.','Amarillo Avz.','Azul','Azul Int.','Azul Avz.','Rojo','Rojo Avz.','Negro']
const RANK_COLOR = { 'Blanco':'from-slate-200 to-slate-300 text-slate-700', 'Amarillo':'from-yellow-300 to-yellow-500 text-yellow-900', 'Amarillo Int.':'from-yellow-300 to-yellow-500 text-yellow-900', 'Amarillo Avz.':'from-yellow-400 to-amber-500 text-yellow-900', 'Azul':'from-blue-400 to-blue-600 text-white', 'Azul Int.':'from-blue-400 to-blue-600 text-white', 'Azul Avz.':'from-blue-500 to-indigo-600 text-white', 'Rojo':'from-red-400 to-red-600 text-white', 'Rojo Avz.':'from-red-500 to-rose-700 text-white', 'Negro':'from-slate-700 to-slate-900 text-white' }

export default function MyStatusPage() {
  const { profile, myStudent, setMyStudent, showToast } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [initiatingPayment, setInitiatingPayment] = useState(false)

  useEffect(() => { load() }, [profile])

  async function load() {
    if (!profile?.student_id) { setLoading(false); return }
    const { data } = await supabase.from('tkd_students').select('*').eq('id', profile.student_id).single()
    setMyStudent(data)
    setLoading(false)
  }

  async function handlePayCuota() {
    if (!myStudent) return
    setInitiatingPayment(true)
    try {
      // Call Supabase Edge Function to create MP preference
      const { data, error } = await supabase.functions.invoke('create-mp-preference', {
        body: {
          student_id: myStudent.id,
          student_name: myStudent.name,
          amount: myStudent.tuition,
          type: 'cuota',
        }
      })
      if (error) throw error
      if (data?.init_point) {
        window.location.href = data.init_point
      } else {
        throw new Error('No se obtuvo URL de pago')
      }
    } catch (err) {
      showToast('El pago con Mercado Pago aún no está configurado. Contactá al administrador.', 'warning')
    } finally {
      setInitiatingPayment(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-60"><i className="fa-solid fa-spinner fa-spin text-white text-3xl" /></div>

  if (!myStudent) {
    return (
      <div className="p-6 text-center">
        <div className="glass-dark rounded-3xl p-8 mx-auto max-w-sm">
          <i className="fa-solid fa-user-xmark text-4xl text-slate-400 mb-4 block" />
          <h3 className="text-white font-bold text-lg mb-2">Cuenta no vinculada</h3>
          <p className="text-slate-400 text-sm">Tu cuenta aún no fue vinculada con un perfil de alumno. Avisale al profe para que lo haga desde el panel de administración.</p>
        </div>
      </div>
    )
  }

  const rankIdx = RANK_ORDER.indexOf(myStudent.rank)
  const nextRank = RANK_ORDER[rankIdx + 1]
  const isPaid = myStudent.debt === 0
  const monthName = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-5 max-w-lg mx-auto space-y-4">
      {/* Greeting */}
      <div className="pt-2">
        <p className="text-slate-400 text-sm font-medium">Bienvenido/a 👋</p>
        <h2 className="text-2xl font-extrabold text-white">{myStudent.name}</h2>
      </div>

      {/* Rank card */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
        className="glass-dark rounded-3xl p-5 border border-white/10"
      >
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Grado actual</p>
        <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r ${RANK_COLOR[myStudent.rank] || 'from-slate-600 to-slate-800 text-white'} font-extrabold text-lg shadow-xl`}>
          <i className="fa-solid fa-ribbon" />
          Cinturón {myStudent.rank}
        </div>
        {nextRank && (
          <p className="text-slate-500 text-sm mt-3">
            Próximo: <span className="text-slate-300 font-semibold">{nextRank}</span>
          </p>
        )}
      </motion.div>

      {/* Cuota card */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        className={`rounded-3xl p-5 border ${isPaid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">Cuota — {monthName}</p>
          <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {isPaid ? '✓ Al día' : '⚠ Pendiente'}
          </span>
        </div>
        {isPaid ? (
          <p className="text-emerald-400 font-bold text-base">Tu cuota está paga. ¡Gracias!</p>
        ) : (
          <>
            <p className="text-3xl font-extrabold text-white mb-1">${myStudent.debt.toLocaleString('es-AR')}</p>
            <p className="text-slate-400 text-sm mb-4">Cuota pendiente de pago</p>
            <button
              onClick={handlePayCuota}
              disabled={initiatingPayment}
              className="w-full py-4 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-extrabold rounded-2xl transition active:scale-[0.98] shadow-xl shadow-blue-900/50 flex items-center justify-center gap-3 text-base"
            >
              {initiatingPayment
                ? <><i className="fa-solid fa-spinner fa-spin" /> Procesando...</>
                : <><i className="fa-brands fa-mercado-pago" /> Pagar con Mercado Pago</>
              }
            </button>
          </>
        )}
      </motion.div>

      {/* Quick info */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
        className="glass-dark rounded-3xl p-5 border border-white/10 grid grid-cols-2 gap-4"
      >
        {[
          { label: 'Cuota mensual', value: `$${myStudent.tuition?.toLocaleString('es-AR')}`, icon: 'fa-dollar-sign' },
          { label: 'Examen', value: myStudent.exam_date ? new Date(myStudent.exam_date+'T12:00:00').toLocaleDateString('es-AR', { day:'numeric', month:'short' }) : 'Sin fecha', icon: 'fa-graduation-cap' },
        ].map(({ label, value, icon }) => (
          <div key={label}>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
            <div className="flex items-center gap-2">
              <i className={`fa-solid ${icon} text-indigo-400 text-sm`} />
              <p className="text-white font-bold text-sm">{value}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

