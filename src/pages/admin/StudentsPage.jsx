import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

const RANKS = ['Blanco','Amarillo','Amarillo Int.','Amarillo Avz.','Azul','Azul Int.','Azul Avz.','Rojo','Rojo Avz.','Negro']
const BLANK = { id: null, name: '', dob: '', rank: 'Blanco', tuition: 12500, debt: 12500, phone: '', location: '', dni: '', cuota_fija: false, exam_paid: false, exam_paid_amount: 0, archived: false }

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active') // active | archived | all
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [payStudent, setPayStudent] = useState(null)
  const [payAmount, setPayAmount] = useState(0)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkStudent, setLinkStudent] = useState(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linking, setLinking] = useState(false)
  const { showToast } = useAppStore()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('tkd_students').select('*').order('name')
    setStudents(data || [])
  }

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.dni || '').includes(search)
    const matchFilter =
      filter === 'all' ? true :
      filter === 'active' ? !s.archived :
      s.archived
    return matchSearch && matchFilter
  })

  function openCreate() {
    setForm({ ...BLANK })
    setShowModal(true)
  }

  function openEdit(st) {
    setForm({ ...st })
    setShowModal(true)
  }

  async function saveStudent() {
    setSaving(true)
    try {
      if (form.id) {
        const { error } = await supabase.from('tkd_students').update({ ...form }).eq('id', form.id)
        if (error) throw error
        showToast('Alumno actualizado')
      } else {
        const { error } = await supabase.from('tkd_students').insert({ ...form, id: undefined })
        if (error) throw error
        showToast('Alumno creado')
      }
      setShowModal(false)
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleArchive(st) {
    await supabase.from('tkd_students').update({ archived: !st.archived }).eq('id', st.id)
    showToast(st.archived ? 'Alumno reactivado' : 'Alumno archivado')
    await load()
  }

  function openPay(st) {
    setPayStudent(st)
    setPayAmount(st.debt || st.tuition)
    setShowPayModal(true)
  }

  async function confirmPay() {
    if (!payStudent || payAmount <= 0) return
    try {
      const { error: pe } = await supabase.from('payments').insert({
        student_id: payStudent.id,
        amount: payAmount,
        type: 'cuota',
        paid_at: new Date().toISOString(),
      })
      if (pe) throw pe
      const newDebt = Math.max(0, (payStudent.debt || 0) - payAmount)
      await supabase.from('tkd_students').update({ debt: newDebt }).eq('id', payStudent.id)
      showToast(`Pago de $${payAmount.toLocaleString('es-AR')} registrado`)
      setShowPayModal(false)
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function linkAccount() {
    if (!linkStudent || !linkEmail) return
    setLinking(true)
    try {
      const { data: userData } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', (await supabase.auth.admin?.getUserByEmail?.(linkEmail))?.data?.user?.id)
        .single()
      // Fetch user by email via RPC or profiles table lookup
      // For now, update profile where email matches via users join
      const { error } = await supabase
        .from('profiles')
        .update({ student_id: linkStudent.id, role: 'alumno' })
        .eq('email', linkEmail)
      if (error) throw error
      showToast('Cuenta vinculada exitosamente')
      setShowLinkModal(false)
    } catch (err) {
      showToast('Para vincular, el alumno debe registrarse primero. Luego ve a la tabla profiles en Supabase.', 'warning')
    } finally {
      setLinking(false)
    }
  }

  const rankColor = (rank) => {
    const map = { 'Blanco': 'bg-slate-100 text-slate-600', 'Amarillo': 'bg-yellow-100 text-yellow-700', 'Amarillo Int.': 'bg-yellow-100 text-yellow-700', 'Amarillo Avz.': 'bg-yellow-100 text-yellow-700', 'Azul': 'bg-blue-100 text-blue-700', 'Azul Int.': 'bg-blue-100 text-blue-700', 'Azul Avz.': 'bg-blue-100 text-blue-700', 'Rojo': 'bg-red-100 text-red-700', 'Rojo Avz.': 'bg-red-100 text-red-700', 'Negro': 'bg-slate-900 text-white' }
    return map[rank] || 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Alumnos</h2>
          <p className="text-slate-500 text-sm">{filtered.length} alumnos</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 transition active:scale-95"
        >
          <i className="fa-solid fa-plus" /> Nuevo
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nombre o DNI..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700 shadow-sm"
          />
        </div>
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {[['active','Activos'],['archived','Archivados'],['all','Todos']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === val ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >{lbl}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((st, i) => (
            <motion.div
              key={st.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.03 }}
              className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 ${st.archived ? 'opacity-60' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 shrink-0 text-sm">
                {st.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-900 text-sm">{st.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rankColor(st.rank)}`}>{st.rank}</span>
                  {st.archived && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Archivado</span>}
                </div>
                <div className="flex gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                  {st.phone && <span><i className="fa-solid fa-phone mr-1" />{st.phone}</span>}
                  {st.dni && <span>DNI {st.dni}</span>}
                  <span className={st.debt > 0 ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                    {st.debt > 0 ? `Debe $${st.debt.toLocaleString('es-AR')}` : 'Al día ✓'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {st.debt > 0 && (
                  <button onClick={() => openPay(st)}
                    className="text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition">
                    Cobrar
                  </button>
                )}
                <button onClick={() => openEdit(st)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition">
                  <i className="fa-solid fa-pen text-xs" />
                </button>
                <button onClick={() => { setLinkStudent(st); setShowLinkModal(true); setLinkEmail('') }}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-100 flex items-center justify-center text-slate-600 hover:text-blue-600 transition"
                  title="Vincular cuenta">
                  <i className="fa-solid fa-link text-xs" />
                </button>
                <button onClick={() => toggleArchive(st)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-100 flex items-center justify-center text-slate-600 hover:text-amber-600 transition">
                  <i className={`fa-solid ${st.archived ? 'fa-rotate-left' : 'fa-box-archive'} text-xs`} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <i className="fa-solid fa-users-slash text-4xl mb-3 block" />
            <p className="font-semibold">No hay alumnos para mostrar</p>
          </div>
        )}
      </div>

      {/* Student Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900">{form.id ? 'Editar alumno' : 'Nuevo alumno'}</h3>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                {[
                  { label: 'Nombre completo', key: 'name', type: 'text', required: true },
                  { label: 'DNI', key: 'dni', type: 'text' },
                  { label: 'Teléfono', key: 'phone', type: 'tel' },
                  { label: 'Fecha de nacimiento', key: 'dob', type: 'date' },
                  { label: 'Localidad', key: 'location', type: 'text' },
                ].map(({ label, key, type, required }) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
                    <input type={type} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })}
                      required={required}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Grado / Cinturón</label>
                  <select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {RANKS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cuota</label>
                    <input type="number" value={form.tuition} onChange={e => setForm({ ...form, tuition: +e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Deuda actual</label>
                    <input type="number" value={form.debt} onChange={e => setForm({ ...form, debt: +e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="cuota_fija" checked={form.cuota_fija} onChange={e => setForm({ ...form, cuota_fija: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600" />
                  <label htmlFor="cuota_fija" className="text-sm font-semibold text-slate-700">Cuota fija (no escalonada)</label>
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 transition">
                  Cancelar
                </button>
                <button onClick={saveStudent} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition disabled:opacity-50 shadow-lg shadow-indigo-200"
                >
                  {saving ? <i className="fa-solid fa-spinner fa-spin" /> : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pay Modal */}
      <AnimatePresence>
        {showPayModal && payStudent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowPayModal(false)}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6"
            >
              <h3 className="font-extrabold text-slate-900 mb-1">Registrar pago</h3>
              <p className="text-slate-500 text-sm mb-4">{payStudent.name}</p>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Monto</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(+e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowPayModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-700">Cancelar</button>
                <button onClick={confirmPay} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-200 transition">
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link Account Modal */}
      <AnimatePresence>
        {showLinkModal && linkStudent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowLinkModal(false)}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6"
            >
              <h3 className="font-extrabold text-slate-900 mb-1">Vincular cuenta</h3>
              <p className="text-slate-500 text-sm mb-4">Alumno: <strong>{linkStudent.name}</strong></p>
              <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                El alumno debe haberse registrado primero en la app. Ingresá su email de registro.
              </p>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email del alumno</label>
              <input type="email" value={linkEmail} onChange={e => setLinkEmail(e.target.value)} placeholder="alumno@email.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
              />
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                💡 Alternativa: En Supabase → tabla <code>profiles</code> → buscá el email → actualizá el campo <code>student_id</code> con el ID del alumno.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowLinkModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-700">Cerrar</button>
                <button onClick={linkAccount} disabled={linking}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition disabled:opacity-50"
                >
                  {linking ? <i className="fa-solid fa-spinner fa-spin" /> : 'Vincular'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

