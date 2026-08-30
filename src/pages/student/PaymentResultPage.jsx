import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

export default function PaymentResultPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useAppStore()
  const status = params.get('status') || params.get('collection_status')
  const externalRef = params.get('external_reference')

  useEffect(() => {
    if (status === 'approved') {
      showToast('¡Pago aprobado! Tu cuota fue acreditada.', 'success')
    }
  }, [status])

  const isApproved = status === 'approved'
  const isPending = status === 'pending' || status === 'in_process'

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
        className="glass-dark rounded-3xl border border-white/10 p-8 text-center w-full"
      >
        {isApproved ? (
          <>
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-circle-check text-emerald-400 text-4xl" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">¡Pago aprobado!</h2>
            <p className="text-slate-400 mb-6">Tu pago fue acreditado exitosamente. ¡Gracias!</p>
          </>
        ) : isPending ? (
          <>
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-clock text-amber-400 text-4xl" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Pago pendiente</h2>
            <p className="text-slate-400 mb-6">Tu pago está siendo procesado. Te avisaremos cuando se acredite.</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-circle-xmark text-red-400 text-4xl" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Pago no completado</h2>
            <p className="text-slate-400 mb-6">Ocurrió un problema con el pago. Podés intentarlo nuevamente.</p>
          </>
        )}
        <button onClick={() => navigate('/portal/status')}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition"
        >
          Volver al inicio
        </button>
      </motion.div>
    </div>
  )
}
