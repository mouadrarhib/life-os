import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const RANGE_OPTIONS = ['today', '7d', '30d', 'all']

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function getRangeStart(range) {
  if (range === 'all') return null
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  if (range === '7d') date.setDate(date.getDate() - 6)
  if (range === '30d') date.setDate(date.getDate() - 29)
  return date.toISOString()
}

export function FocusHistoryPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [range, setRange] = useState('7d')
  const [modeFilter, setModeFilter] = useState('all')
  const [includeBreaks, setIncludeBreaks] = useState(false)

  const loadHistory = async () => {
    setLoading(true)
    let query = supabase
      .from('task_focus_sessions')
      .select('id, task_id, mode, status, is_break, planned_minutes, actual_minutes, started_at, ended_at, task:tasks(title)')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    const startIso = getRangeStart(range)
    if (startIso) query = query.gte('started_at', startIso)

    const { data, error } = await query
    if (error) {
      if (error.code === '42P01') {
        setErrorMessage('Focus tracking table missing. Run supabase/014_task_focus.sql.')
      } else {
        setErrorMessage(error.message)
      }
      setRows([])
      setLoading(false)
      return
    }

    setRows(data || [])
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadHistory()
  }, [user.id, range])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesMode = modeFilter === 'all' || row.mode === modeFilter
      const matchesBreaks = includeBreaks || !row.is_break
      return matchesMode && matchesBreaks
    })
  }, [rows, modeFilter, includeBreaks])

  const summary = useMemo(() => {
    const completedFocusRows = filteredRows.filter((row) => row.status === 'completed' && !row.is_break)
    const completedBreakRows = filteredRows.filter((row) => row.status === 'completed' && row.is_break)
    const totalMinutes = completedFocusRows.reduce((sum, row) => sum + Number(row.actual_minutes || 0), 0)
    const avgMinutes =
      completedFocusRows.length > 0 ? Math.round(totalMinutes / completedFocusRows.length) : 0

    return {
      totalMinutes,
      focusBlocks: completedFocusRows.length,
      breakBlocks: completedBreakRows.length,
      avgMinutes,
    }
  }, [filteredRows])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <main className="dashboard-layout focus-history-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Focus</p>
          <h1>Session History</h1>
          <p className="muted">Track all focus and break sessions to measure deep work consistency.</p>
        </div>

        <div className="header-actions">
          <Link to="/tasks" className="ghost-link">
            Back to tasks
          </Link>
          <button type="button" className="primary-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>

      <section className="stats-grid focus-history-stats">
        <article className="stat-card">
          <p className="muted small-text">Focus minutes</p>
          <p className="stat-value">{summary.totalMinutes}m</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Focus blocks</p>
          <p className="stat-value">{summary.focusBlocks}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Break blocks</p>
          <p className="stat-value">{summary.breakBlocks}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Avg focus block</p>
          <p className="stat-value">{summary.avgMinutes}m</p>
        </article>
      </section>

      <section className="panel focus-history-panel">
        <div className="focus-history-filters">
          <label>
            Range
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              {RANGE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item === 'today' ? 'Today' : item === '7d' ? 'Last 7 days' : item === '30d' ? 'Last 30 days' : 'All time'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
              <option value="all">All modes</option>
              <option value="pomodoro">Pomodoro</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="focus-break-toggle">
            <input
              type="checkbox"
              checked={includeBreaks}
              onChange={(event) => setIncludeBreaks(event.target.checked)}
            />
            Include breaks
          </label>
          <button type="button" className="ghost-action" onClick={loadHistory}>
            Refresh
          </button>
        </div>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
        {loading ? <p className="muted">Loading focus history...</p> : null}

        {!loading && filteredRows.length === 0 ? <p className="muted">No sessions in this range.</p> : null}

        <div className="focus-history-list">
          {filteredRows.map((row) => (
            <article key={row.id} className="focus-history-item">
              <div>
                <p className="task-title">{row.task?.title || 'Task deleted'}</p>
                <p className="muted small-text">Started: {formatDateTime(row.started_at)}</p>
                <p className="muted small-text">Ended: {formatDateTime(row.ended_at)}</p>
              </div>
              <div className="focus-history-right">
                <span className="client-status">{row.mode}</span>
                <p className="muted small-text">Status: {row.status}</p>
                <p className="muted small-text">{row.is_break ? 'Break block' : 'Focus block'}</p>
                <p className="muted small-text">
                  Planned: {row.planned_minutes || '-'}m / Actual: {row.actual_minutes || '-'}m
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
