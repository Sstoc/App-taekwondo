import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

export default function MyAttendancePage() {
  const { profile } = useAppStore()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  useEffect(() => { load() }, [profile, month])

  async function load() {
    if (!profile?.student_id) { setLoading(false); return }
    const [year, m] = month.split('-').map(Number)
    const from = new Date(year, m-1, 1).toISOString().split('T')[0]
    const to = new Date(year, m, 1).toISOString().split('T')[0]
    const { data } = await supabase
      .from('attendance')
      .select('date')
      .eq('student_id', profile.student_id)
      .gte('date', from)
      .lt('date', to)
      .order('date', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }

  const [year, m] = month.split('-').map(Number)
  const daysInMonth = new Date(year, m, 0).getDate()
  const presentDays = new Set(records.map(r => r.date))
  const pct = Math.round((presentDays.size / daysInMonth) * 100)

  return (
    <div className="p-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-extrabold text-white">Mi asistencia</h2>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>

      {/* Summary */}
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
        className="glass-dark rounded-3xl border border-white/10 p-5 mb-4 flex items-center gap-5"
      >
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="8" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#34d399" strokeWidth="8"
              strokeDasharray={`${2*Math.PI*34}`}
              strokeDashoffset={`${2*Math.PI*34*(1 - pct/100)}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white font-extrabold text-lg">{pct}%</span>
        </div>
        <div>
          <p className="text-3xl font-extrabold text-white">{presentDays.size}</p>
          <p className="text-slate-400 text-sm">días de clase este mes</p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-8"><i className="fa-solid fa-spinner fa-spin text-white text-2xl" /></div>
      ) : records.length === 0 ? (
        <div className="glass-dark rounded-3xl p-8 text-center border border-white/10">
          <i className="fa-solid fa-calendar-xmark text-3xl text-slate-500 mb-3 block" />
          <p className="text-slate-400 font-semibold">Sin asistencias registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r, i) => {
            const d = new Date(r.date + 'T12:00:00')
            return (
              <motion.div key={r.date} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.03 }}
                className="glass-dark rounded-2xl border border-white/10 p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-check text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm capitalize">
                    {d.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
