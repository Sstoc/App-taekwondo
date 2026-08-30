import { useAppStore } from '../../store/useAppStore'
import { motion, AnimatePresence } from 'framer-motion'

export default function Toast() {
  const { toast } = useAppStore()
  const colors = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-indigo-500',
  }

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl text-white font-semibold text-sm shadow-2xl flex items-center gap-2 ${colors[toast.type] || colors.info}`}
        >
          {toast.type === 'success' && <span>✓</span>}
          {toast.type === 'error' && <span>✕</span>}
          {toast.type === 'warning' && <span>⚠</span>}
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
