import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'

export default function HistoryPage() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)
    const [year, m] = month.split('-').map(Number)
    const from = new Date(year, m-1, 1).toISOString()
    const to = new Date(year, m, 1).toISOString()
    const { data } = await supabase
      .from('payments')
      .select('*, tkd_students(name)')
      .gte('paid_at', from)
      .lt('paid_at', to)
      .order('paid_at', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }

  const total = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Historial de pagos</h2>
          <p className="text-slate-500 text-sm">{payments.length} movimientos · Total: <strong className="text-slate-800">${total.toLocaleString('es-AR')}</strong></p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><i className="fa-solid fa-spinner fa-spin text-indigo-500 text-3xl" /></div>
      ) : (
        <div className="space-y-2">
          {payments.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*0.03 }}
              className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-money-bill text-emerald-600 text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate">{p.tkd_students?.name || 'Alumno'}</p>
                <p className="text-xs text-slate-500">{new Date(p.paid_at).toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' })} · {p.type}</p>
              </div>
              <p className="font-extrabold text-emerald-600 text-base shrink-0">${p.amount.toLocaleString('es-AR')}</p>
            </motion.div>
          ))}
          {payments.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <i className="fa-solid fa-receipt text-4xl mb-3 block" />
              <p className="font-semibold">Sin pagos registrados en este mes</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

