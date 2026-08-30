import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'

const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

export default function SchedulePage() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('schedules').select('*').order('day_of_week').order('start_time')
      .then(({ data }) => { setSchedules(data || []); setLoading(false) })
  }, [])

  if (loading) return <div className="flex justify-center py-16"><i className="fa-solid fa-spinner fa-spin text-white text-3xl" /></div>

  if (schedules.length === 0) {
    return (
      <div className="p-5 max-w-lg mx-auto">
        <h2 className="text-2xl font-extrabold text-white mb-5">Horarios</h2>
        <div className="glass-dark rounded-3xl p-10 text-center border border-white/10">
          <i className="fa-solid fa-clock text-4xl text-slate-500 mb-4 block" />
          <p className="text-slate-300 font-semibold mb-2">Sin horarios cargados</p>
          <p className="text-slate-500 text-sm">El administrador puede cargar los horarios desde el panel.</p>
        </div>
      </div>
    )
  }

  const grouped = DAYS.reduce((acc, _, i) => {
    const daySchedules = schedules.filter(s => s.day_of_week === i)
    if (daySchedules.length > 0) acc[i] = daySchedules
    return acc
  }, {})

  return (
    <div className="p-5 max-w-lg mx-auto">
      <h2 className="text-2xl font-extrabold text-white mb-5">Horarios</h2>
      <div className="space-y-3">
        {Object.entries(grouped).map(([dayIdx, slots], i) => (
          <motion.div key={dayIdx} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}
            className="glass-dark rounded-2xl border border-white/10 overflow-hidden"
          >
            <div className="bg-white/5 px-4 py-2.5">
              <p className="text-white font-extrabold text-sm">{DAYS[dayIdx]}</p>
            </div>
            {slots.map(slot => (
              <div key={slot.id} className="px-4 py-3 flex items-center gap-3 border-t border-white/5">
                <i className="fa-solid fa-clock text-indigo-400 text-sm" />
                <p className="text-slate-300 font-semibold text-sm">
                  {slot.start_time?.slice(0,5)} — {slot.end_time?.slice(0,5)}
                </p>
                {slot.location && <p className="text-slate-500 text-sm ml-auto">{slot.location}</p>}
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
