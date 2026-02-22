import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, timezone')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (data?.full_name?.trim()) {
        navigate('/dashboard', { replace: true })
        return
      }

      if (data?.full_name) setFullName(data.full_name)
      if (data?.timezone) setTimezone(data.timezone)
      setLoading(false)
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [navigate, user.id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    const payload = {
      id: user.id,
      full_name: fullName.trim(),
      timezone: timezone.trim() || 'UTC',
    }

    const { error } = await supabase.from('profiles').upsert(payload)

    setBusy(false)

    if (error) {
      setMessage(error.message)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  if (loading) {
    return <div className="screen-center">Loading onboarding...</div>
  }

  return (
    <main className="auth-layout">
      <section className="panel">
        <p className="eyebrow">Profile Setup</p>
        <h1>Tell us about you</h1>
        <p className="muted">This is the minimum profile info needed to start your Life OS.</p>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Full name
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your full name"
              required
            />
          </label>

          <label>
            Timezone
            <input
              type="text"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="UTC"
              required
            />
          </label>

          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {message ? <p className="message error">{message}</p> : null}
      </section>
    </main>
  )
}
