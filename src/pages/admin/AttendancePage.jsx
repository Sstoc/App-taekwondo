import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

export default function AttendancePage() {
  const [students, setStudents] = useState([])
  const [present, setPresent] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const { showToast } = useAppStore()

  useEffect(() => {
    loadStudents()
  }, [date])

  async function loadStudents() {
    const { data: stds } = await supabase.from('tkd_students').select('id,name,rank').eq('archived', false).order('name')
    const { data: att } = await supabase.from('attendance').select('student_id').eq('date', date)
    setStudents(stds || [])
    setPresent(new Set((att || []).map(a => a.student_id)))
  }

  function toggle(id) {
    setPresent(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      await supabase.from('attendance').delete().eq('date', date)
      if (present.size > 0) {
        const rows = [...present].map(id => ({ student_id: id, date }))
        const { error } = await supabase.from('attendance').insert(rows)
        if (error) throw error
      }
      showToast(`Asistencia guardada: ${present.size} presentes`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Asistencia</h2>
          <p className="text-slate-500 text-sm">{present.size} de {students.length} presentes</p>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
        />
      </div>

      <div className="relative mb-4">
        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar alumno..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm text-slate-700"
        />
      </div>

      <div className="space-y-2 mb-6">
        {filtered.map((st, i) => {
          const isPresent = present.has(st.id)
          return (
            <motion.button
              key={st.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => toggle(st.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                isPresent
                  ? 'bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-100'
                  : 'bg-white border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
                isPresent ? 'bg-emerald-500' : 'bg-slate-200'
              }`}>
                {isPresent && <i className="fa-solid fa-check text-white text-xs" />}
              </div>
              <span className={`font-semibold text-sm flex-1 ${isPresent ? 'text-emerald-800' : 'text-slate-700'}`}>{st.name}</span>
              <span className="text-xs font-bold text-slate-400">{st.rank}</span>
            </motion.button>
          )
        })}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-200 transition active:scale-[0.98] text-base"
      >
        {saving ? <i className="fa-solid fa-spinner fa-spin" /> : `Guardar asistencia (${present.size} presentes)`}
      </button>
    </div>
  )
}

