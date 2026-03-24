import { useEffect, useRef } from 'react'

export default function KingKohliVideoOverlay({ open, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const v = videoRef.current
    if (!open || !v) return
    v.currentTime = 0
    const tryPlay = async () => {
      v.muted = false
      try {
        await v.play()
      } catch {
        v.muted = true
        await v.play().catch(() => {})
      }
    }
    tryPlay()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    const v = videoRef.current
    if (open || !v) return
    v.pause()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Watch King Kohli best contribution"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute top-3 right-3 md:top-6 md:right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 text-xl font-light leading-none"
        aria-label="Close video"
      >
        ×
      </button>
      <div className="relative w-full max-w-6xl max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <video
          ref={videoRef}
          src="/assets/gg.mp4"
          controls
          loop
          playsInline
          className="max-h-[90vh] w-full rounded-lg shadow-2xl shadow-pink-900/30"
        />
      </div>
    </div>
  )
}
