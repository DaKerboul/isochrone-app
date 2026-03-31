import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function Toast(): React.JSX.Element {
  const toasts = useAppStore((s) => s.toasts)
  const removeToast = useAppStore((s) => s.removeToast)

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} message={t.message} type={t.type} duration={t.duration} onRemove={removeToast} />
      ))}
    </div>
  )
}

function ToastItem({
  id, message, type, duration = 4000, onRemove
}: {
  id: string; message: string; type: 'success'|'error'|'info'; duration?: number; onRemove: (id: string) => void
}): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, onRemove])

  return (
    <div className={`toast toast--${type}`}>
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={() => onRemove(id)}>×</button>
    </div>
  )
}
