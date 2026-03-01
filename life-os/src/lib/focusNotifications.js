export function canUseBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function ensureNotificationPermission() {
  if (!canUseBrowserNotifications()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return 'denied'
  }
}

export function notifyFocusEvent(title, body) {
  if (!canUseBrowserNotifications()) return
  if (Notification.permission !== 'granted') return

  try {
    new Notification(title, { body })
  } catch {
    // no-op
  }
}

export function playFocusChime() {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return

  try {
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.36)

    osc.onended = () => {
      ctx.close().catch(() => {})
    }
  } catch {
    // no-op
  }
}
