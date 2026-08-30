import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'

const card = (idx) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: idx * 0.07, duration: 0.35 }
})

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0, paid: 0, unpaid: 0, debtSum: 0, monthlyRevenue: 0, attendance: 0
  })
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const monthLabel = now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    async function load() {
      const { data: students } = await supabase
        .from('tkd_students')
        .select('*')
        .eq('archived', false)

      const { data: payments } = await supabase
        .from('payments')
        .select('amount, paid_at')
        .gte('paid_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())

      const { data: attendance } = await supabase
        .from('attendance')
        .select('id')
        .gte('date', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])

      const total = students?.length || 0
      const debtSum = students?.reduce((s, st) => s + (st.debt || 0), 0) || 0
      const paidStudents = students?.filter(s => s.debt === 0).length || 0
      const monthlyRevenue = payments?.reduce((s, p) => s + p.amount, 0) || 0

      setStats({
        total,
        paid: paidStudents,
        unpaid: total - paidStudents,
        debtSum,
        monthlyRevenue,
        attendance: attendance?.length || 0
      })
      setLoading(false)
    }
    load()
  }, [])

  const CARDS = [
    { label: 'Alumnos activos', value: stats.total, icon: 'fa-users', color: 'from-indigo-500 to-indigo-700', sub: 'Total inscriptos' },
    { label: 'Al día', value: stats.paid, icon: 'fa-circle-check', color: 'from-emerald-500 to-emerald-700', sub: 'Sin deuda' },
    { label: 'Con deuda', value: stats.unpaid, icon: 'fa-circle-exclamation', color: 'from-amber-500 to-amber-700', sub: 'Deben pagar' },
    { label: 'Deuda total', value: `$${stats.debtSum.toLocaleString('es-AR')}`, icon: 'fa-triangle-exclamation', color: 'from-red-500 to-red-700', sub: 'Pendiente de cobro' },
    { label: 'Recaudado', value: `$${stats.monthlyRevenue.toLocaleString('es-AR')}`, icon: 'fa-money-bill-wave', color: 'from-teal-500 to-teal-700', sub: monthLabel },
    { label: 'Asistencias', value: stats.attendance, icon: 'fa-clipboard-check', color: 'from-violet-500 to-violet-700', sub: 'Este mes' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-900">Panel General</h2>
        <p className="text-slate-500 text-sm mt-1 capitalize">{monthLabel}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <i className="fa-solid fa-spinner fa-spin text-indigo-500 text-3xl" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map((c, i) => (
            <motion.div key={c.label} {...card(i)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-3 shadow-lg`}>
                <i className={`fa-solid ${c.icon} text-white text-sm`} />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{c.value}</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">{c.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

