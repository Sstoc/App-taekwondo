import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

export default function MyPaymentsPage() {
  const { profile } = useAppStore()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [profile])

  async function load() {
    if (!profile?.student_id) { setLoading(false); return }
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', profile.student_id)
      .order('paid_at', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }

  const typeIcon = (type) => ({ cuota: 'fa-money-bill-wave', examen: 'fa-graduation-cap', otro: 'fa-circle-dollar-to-slot' }[type] || 'fa-dollar-sign')
  const typeColor = (type) => ({ cuota: 'text-emerald-400 bg-emerald-500/10', examen: 'text-violet-400 bg-violet-500/10', otro: 'text-blue-400 bg-blue-500/10' }[type] || 'text-slate-400 bg-slate-500/10')

  const total = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-5 max-w-lg mx-auto">
      <div className="mb-5">
        <h2 className="text-2xl font-extrabold text-white">Mis pagos</h2>
        <p className="text-slate-400 text-sm mt-1">Total abonado: <span className="text-emerald-400 font-bold">${total.toLocaleString('es-AR')}</span></p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><i className="fa-solid fa-spinner fa-spin text-white text-3xl" /></div>
      ) : payments.length === 0 ? (
        <div className="glass-dark rounded-3xl p-10 text-center border border-white/10">
          <i className="fa-solid fa-receipt text-4xl text-slate-500 mb-4 block" />
          <p className="text-slate-400 font-semibold">Sin pagos registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.04 }}
              className="glass-dark rounded-2xl border border-white/10 p-4 flex items-center gap-4"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColor(p.type)}`}>
                <i className={`fa-solid ${typeIcon(p.type)} text-sm`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm capitalize">{p.type}</p>
                <p className="text-slate-500 text-xs">
                  {new Date(p.paid_at).toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
                </p>
              </div>
              <p className="text-emerald-400 font-extrabold text-base shrink-0">${p.amount.toLocaleString('es-AR')}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
