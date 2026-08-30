import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

export default function ExamsPage() {
  const [students, setStudents] = useState([])
  const [examDate, setExamDate] = useState('')
  const [examAmount, setExamAmount] = useState(15000)
  const [saving, setSaving] = useState(false)
  const { showToast } = useAppStore()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('tkd_students').select('*').eq('archived', false).order('name')
    setStudents(data || [])
  }

  async function setExamForAll() {
    if (!examDate) return showToast('Ingresá una fecha de examen', 'warning')
    setSaving(true)
    try {
      const { error } = await supabase.from('tkd_students')
        .update({ exam_date: examDate, exam_amount: examAmount, exam_paid: false })
        .eq('archived', false)
      if (error) throw error
      showToast('Examen cargado para todos los alumnos')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleExamPaid(st) {
    const newVal = !st.exam_paid
    await supabase.from('tkd_students').update({ exam_paid: newVal }).eq('id', st.id)
    if (newVal) {
      await supabase.from('payments').insert({ student_id: st.id, amount: st.exam_amount || examAmount, type: 'examen', paid_at: new Date().toISOString() })
      showToast(`Examen de ${st.name} marcado como pagado`)
    }
    await load()
  }

  const withExam = students.filter(s => s.exam_date)
  const paidCount = withExam.filter(s => s.exam_paid).length

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-900">Examen / Grading</h2>
        <p className="text-slate-500 text-sm">Gestión de exámenes de grado</p>
      </div>

      {/* Setup card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <h3 className="font-bold text-slate-800 mb-4">Configurar próximo examen</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha</label>
            <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Monto ($)</label>
            <input type="number" value={examAmount} onChange={e => setExamAmount(+e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
        <button onClick={setExamForAll} disabled={saving}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition"
        >
          {saving ? <i className="fa-solid fa-spinner fa-spin" /> : 'Cargar examen a todos los alumnos'}
        </button>
      </div>

      {/* Summary */}
      {withExam.length > 0 && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-indigo-700">{withExam.length}</p>
            <p className="text-xs font-bold text-indigo-500">Con examen</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-emerald-700">{paidCount}</p>
            <p className="text-xs font-bold text-emerald-500">Pagaron</p>
          </div>
          <div className="flex-1 bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-amber-700">{withExam.length - paidCount}</p>
            <p className="text-xs font-bold text-amber-500">Pendientes</p>
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="space-y-2">
        {students.map((st, i) => (
          <motion.div key={st.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*0.03 }}
            className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm">{st.name}</p>
              <p className="text-xs text-slate-500">{st.rank} · {st.exam_date ? new Date(st.exam_date+'T12:00:00').toLocaleDateString('es-AR') : 'Sin examen'}</p>
            </div>
            {st.exam_date && (
              <button onClick={() => toggleExamPaid(st)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  st.exam_paid
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                <i className={`fa-solid ${st.exam_paid ? 'fa-check' : 'fa-clock'}`} />
                {st.exam_paid ? 'Pagó' : 'Pendiente'}
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

