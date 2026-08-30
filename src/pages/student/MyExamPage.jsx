import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

export default function MyExamPage() {
  const { profile, myStudent, setMyStudent, showToast } = useAppStore()
  const [initiatingPayment, setInitiatingPayment] = [false, () => {}]

  useEffect(() => { load() }, [profile])

  async function load() {
    if (!profile?.student_id) return
    const { data } = await supabase.from('tkd_students').select('*').eq('id', profile.student_id).single()
    setMyStudent(data)
  }

  async function handlePayExam() {
    if (!myStudent) return
    try {
      const { data, error } = await supabase.functions.invoke('create-mp-preference', {
        body: {
          student_id: myStudent.id,
          student_name: myStudent.name,
          amount: myStudent.exam_amount || 15000,
          type: 'examen',
        }
      })
      if (error) throw error
      if (data?.init_point) window.location.href = data.init_point
      else throw new Error('URL no disponible')
    } catch {
      showToast('El pago de examen aún no está configurado. Contactá al administrador.', 'warning')
    }
  }

  if (!myStudent?.exam_date) {
    return (
      <div className="p-5 max-w-lg mx-auto">
        <h2 className="text-2xl font-extrabold text-white mb-5">Próximo examen</h2>
        <div className="glass-dark rounded-3xl p-10 text-center border border-white/10">
          <i className="fa-solid fa-graduation-cap text-4xl text-slate-500 mb-4 block" />
          <p className="text-slate-300 font-semibold mb-2">Sin examen programado</p>
          <p className="text-slate-500 text-sm">El profe cargará la fecha cuando esté disponible</p>
        </div>
      </div>
    )
  }

  const examDate = new Date(myStudent.exam_date + 'T12:00:00')
  const daysLeft = Math.ceil((examDate - new Date()) / (1000*60*60*24))
  const isPaid = myStudent.exam_paid
  const amount = myStudent.exam_amount || 15000

  return (
    <div className="p-5 max-w-lg mx-auto">
      <h2 className="text-2xl font-extrabold text-white mb-5">Próximo examen</h2>

      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }}
        className="glass-dark rounded-3xl border border-white/10 overflow-hidden"
      >
        {/* Date banner */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 p-6 text-center">
          <i className="fa-solid fa-graduation-cap text-4xl text-white/80 mb-3 block" />
          <p className="text-violet-200 text-xs font-bold uppercase tracking-widest mb-1">Fecha del examen</p>
          <p className="text-3xl font-extrabold text-white">
            {examDate.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}
          </p>
          {daysLeft > 0 && <p className="text-violet-200 text-sm mt-2">Faltan <strong>{daysLeft}</strong> días</p>}
          {daysLeft <= 0 && <p className="text-violet-200 text-sm mt-2">¡Hoy es el día! 🥋</p>}
        </div>

        <div className="p-5 space-y-4">
          {/* Amount */}
          <div className="flex items-center justify-between py-3 border-b border-white/10">
            <p className="text-slate-400 font-semibold text-sm">Monto del examen</p>
            <p className="text-white font-extrabold text-xl">${amount.toLocaleString('es-AR')}</p>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <p className="text-slate-400 font-semibold text-sm">Estado del pago</p>
            <span className={`text-sm font-extrabold px-4 py-1.5 rounded-full ${isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {isPaid ? '✓ Pagado' : '⚠ Pendiente'}
            </span>
          </div>

          {/* Pay button */}
          {!isPaid && (
            <button onClick={handlePayExam}
              className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white font-extrabold rounded-2xl transition active:scale-[0.98] shadow-xl shadow-blue-900/50 flex items-center justify-center gap-3 mt-2"
            >
              <i className="fa-brands fa-mercado-pago" /> Pagar examen con MP
            </button>
          )}

          {isPaid && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 text-center">
              <p className="text-emerald-400 font-bold">✓ Examen pagado. ¡Mucha suerte!</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

