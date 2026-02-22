import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const STATUS_OPTIONS = ['active', 'done', 'paused', 'cancelled']
const HORIZON_OPTIONS = ['3m', '1y', '5y', 'custom']

function formatDate(value) {
  if (!value) return 'No date'
  return new Date(value).toLocaleDateString()
}

function getTodayStart() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function isOverdue(milestone) {
  if (milestone.done || !milestone.due_date) return false
  const due = new Date(milestone.due_date)
  due.setHours(0, 0, 0, 0)
  return due < getTodayStart()
}

function sortMilestones(items) {
  return [...(items || [])].sort((a, b) => {
    const orderA = Number.isFinite(a.order_index) ? a.order_index : Number.MAX_SAFE_INTEGER
    const orderB = Number.isFinite(b.order_index) ? b.order_index : Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export function GoalsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [draggedMilestone, setDraggedMilestone] = useState(null)

  const [title, setTitle] = useState('')
  const [horizon, setHorizon] = useState('1y')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [why, setWhy] = useState('')
  const [milestoneDraftByGoal, setMilestoneDraftByGoal] = useState({})

  const loadGoals = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('goals')
      .select('id, title, horizon, status, start_date, target_date, why, created_at, milestones(id, title, due_date, done, order_index, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setGoals([])
      setLoading(false)
      return
    }

    const normalized = (data || []).map((goal) => ({
      ...goal,
      milestones: sortMilestones(goal.milestones || []),
    }))

    setGoals(normalized)
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadGoals()
  }, [user.id])

  const filteredGoals = useMemo(() => {
    if (statusFilter === 'all') return goals
    return goals.filter((goal) => goal.status === statusFilter)
  }, [goals, statusFilter])

  const stats = useMemo(() => {
    const total = goals.length
    const active = goals.filter((g) => g.status === 'active').length
    const done = goals.filter((g) => g.status === 'done').length
    const overdue = goals.reduce(
      (acc, goal) => acc + (goal.milestones || []).filter((m) => isOverdue(m)).length,
      0,
    )
    return { total, active, done, overdue }
  }, [goals])

  const handleCreateGoal = async (event) => {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    const payload = {
      user_id: user.id,
      title: title.trim(),
      horizon,
      status: 'active',
      start_date: startDate || null,
      target_date: targetDate || null,
      why: why.trim() || null,
    }

    const { error } = await supabase.from('goals').insert(payload)
    setSaving(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setTitle('')
    setWhy('')
    setStartDate('')
    setTargetDate('')
    setHorizon('1y')
    await loadGoals()
  }

  const handleGoalStatusChange = async (goalId, status) => {
    const { error } = await supabase.from('goals').update({ status }).eq('id', goalId)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await loadGoals()
  }

  const handleDeleteGoal = async (goalId) => {
    const { error } = await supabase.from('goals').delete().eq('id', goalId)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await loadGoals()
  }

  const handleMilestoneDraft = (goalId, field, value) => {
    setMilestoneDraftByGoal((prev) => ({
      ...prev,
      [goalId]: {
        title: prev[goalId]?.title || '',
        dueDate: prev[goalId]?.dueDate || '',
        [field]: value,
      },
    }))
  }

  const handleCreateMilestone = async (goalId) => {
    const draft = milestoneDraftByGoal[goalId]
    const goal = goals.find((item) => item.id === goalId)
    if (!draft?.title?.trim() || !goal) return

    const maxOrder = (goal.milestones || []).reduce(
      (max, m) => Math.max(max, Number(m.order_index || 0)),
      0,
    )

    const payload = {
      goal_id: goalId,
      title: draft.title.trim(),
      due_date: draft.dueDate || null,
      done: false,
      order_index: maxOrder + 1,
    }

    const { error } = await supabase.from('milestones').insert(payload)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setMilestoneDraftByGoal((prev) => ({
      ...prev,
      [goalId]: { title: '', dueDate: '' },
    }))
    await loadGoals()
  }

  const handleToggleMilestone = async (milestoneId, done) => {
    const { error } = await supabase.from('milestones').update({ done: !done }).eq('id', milestoneId)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await loadGoals()
  }

  const handleDeleteMilestone = async (milestoneId) => {
    const { error } = await supabase.from('milestones').delete().eq('id', milestoneId)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await loadGoals()
  }

  const persistMilestoneOrder = async (goalId, milestoneList) => {
    const updates = milestoneList.map((item, index) =>
      supabase.from('milestones').update({ order_index: index + 1 }).eq('id', item.id),
    )
    const results = await Promise.all(updates)
    const hasError = results.find((result) => result.error)
    if (hasError) {
      setErrorMessage(hasError.error.message)
      await loadGoals()
      return
    }

    setGoals((prev) =>
      prev.map((goal) => {
        if (goal.id !== goalId) return goal
        return {
          ...goal,
          milestones: milestoneList.map((item, index) => ({ ...item, order_index: index + 1 })),
        }
      }),
    )
  }

  const reorderMilestones = async (goalId, draggedId, targetId) => {
    const goal = goals.find((item) => item.id === goalId)
    if (!goal) return

    const milestoneList = [...(goal.milestones || [])]
    const fromIndex = milestoneList.findIndex((item) => item.id === draggedId)
    const toIndex = milestoneList.findIndex((item) => item.id === targetId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

    const [moved] = milestoneList.splice(fromIndex, 1)
    milestoneList.splice(toIndex, 0, moved)
    await persistMilestoneOrder(goalId, milestoneList)
  }

  const moveMilestone = async (goalId, milestoneId, direction) => {
    const goal = goals.find((item) => item.id === goalId)
    if (!goal) return
    const milestoneList = [...(goal.milestones || [])]
    const index = milestoneList.findIndex((item) => item.id === milestoneId)
    if (index < 0) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= milestoneList.length) return

    const [moved] = milestoneList.splice(index, 1)
    milestoneList.splice(targetIndex, 0, moved)
    await persistMilestoneOrder(goalId, milestoneList)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <main className="dashboard-layout goals-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Goals</p>
          <h1>Goals Planner</h1>
          <p className="muted">Plan long-term outcomes and break them into milestones.</p>
        </div>

        <div className="header-actions">
          <Link to="/dashboard" className="ghost-link">
            Back to dashboard
          </Link>
          <button type="button" className="primary-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>

      <section className="stats-grid goals-stats-grid">
        <article className="stat-card">
          <p className="muted small-text">Total goals</p>
          <p className="stat-value">{stats.total}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Active</p>
          <p className="stat-value">{stats.active}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Completed</p>
          <p className="stat-value">{stats.done}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Overdue milestones</p>
          <p className="stat-value">{stats.overdue}</p>
        </article>
      </section>

      <section className="panel goals-panel">
        <form onSubmit={handleCreateGoal} className="form-grid create-goal-form">
          <label>
            Goal title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Build a stronger body in 12 months"
              required
            />
          </label>

          <div className="goal-row">
            <label>
              Horizon
              <select value={horizon} onChange={(event) => setHorizon(event.target.value)}>
                {HORIZON_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start date
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              Target date
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </label>
          </div>

          <label>
            Why this goal
            <input
              value={why}
              onChange={(event) => setWhy(event.target.value)}
              placeholder="I want more discipline and better health"
            />
          </label>

          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Create goal'}
          </button>
        </form>

        <div className="filter-row top-filter-row">
          {['all', ...STATUS_OPTIONS].map((item) => (
            <button
              key={item}
              type="button"
              className={`chip ${statusFilter === item ? 'chip-active' : ''}`}
              onClick={() => setStatusFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
        {loading ? <p className="muted">Loading goals...</p> : null}

        <div className="goals-list">
          {filteredGoals.map((goal) => {
            const doneCount = (goal.milestones || []).filter((m) => m.done).length
            const totalCount = goal.milestones?.length || 0
            const overdueCount = (goal.milestones || []).filter((m) => isOverdue(m)).length
            const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0
            const draft = milestoneDraftByGoal[goal.id] || { title: '', dueDate: '' }

            return (
              <article key={goal.id} className="goal-card">
                <div className="goal-head">
                  <div>
                    <p className="task-title">{goal.title}</p>
                    <p className="muted small-text">
                      {goal.horizon} horizon - {formatDate(goal.start_date)} to {formatDate(goal.target_date)}
                    </p>
                    {goal.why ? <p className="muted small-text">Why: {goal.why}</p> : null}
                    {overdueCount > 0 ? (
                      <p className="overdue-badge">{overdueCount} overdue milestone(s)</p>
                    ) : null}
                  </div>

                  <div className="task-actions">
                    <select
                      value={goal.status}
                      onChange={(event) => handleGoalStatusChange(goal.id, event.target.value)}
                    >
                      {STATUS_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="danger-btn" onClick={() => handleDeleteGoal(goal.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                <div className="goal-progress-row">
                  <span className="muted small-text">
                    Milestones: {doneCount}/{totalCount}
                  </span>
                  <span className="muted small-text">{percent}%</span>
                </div>
                <div className="goal-progress-track">
                  <div className="goal-progress-fill" style={{ width: `${percent}%` }} />
                </div>

                <div className="milestone-list">
                  {(goal.milestones || []).map((milestone) => (
                    <div
                      key={milestone.id}
                      className={`milestone-item ${isOverdue(milestone) ? 'overdue' : ''}`}
                      draggable
                      onDragStart={() => setDraggedMilestone({ goalId: goal.id, milestoneId: milestone.id })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={async () => {
                        if (!draggedMilestone || draggedMilestone.goalId !== goal.id) return
                        await reorderMilestones(goal.id, draggedMilestone.milestoneId, milestone.id)
                        setDraggedMilestone(null)
                      }}
                      onDragEnd={() => setDraggedMilestone(null)}
                    >
                      <button
                        type="button"
                        className={milestone.done ? 'milestone-check done' : 'milestone-check'}
                        onClick={() => handleToggleMilestone(milestone.id, milestone.done)}
                      >
                        {milestone.done ? 'Done' : 'Open'}
                      </button>
                      <div>
                        <p className="task-title milestone-title">{milestone.title}</p>
                        <p className="muted small-text">Due {formatDate(milestone.due_date)}</p>
                      </div>
                      <div className="milestone-actions">
                        <button
                          type="button"
                          className="ghost-order-btn"
                          onClick={() => moveMilestone(goal.id, milestone.id, 'up')}
                          aria-label="Move milestone up"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="ghost-order-btn"
                          onClick={() => moveMilestone(goal.id, milestone.id, 'down')}
                          aria-label="Move milestone down"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => handleDeleteMilestone(milestone.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="milestone-form">
                  <input
                    value={draft.title}
                    onChange={(event) => handleMilestoneDraft(goal.id, 'title', event.target.value)}
                    placeholder="New milestone"
                  />
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) => handleMilestoneDraft(goal.id, 'dueDate', event.target.value)}
                  />
                  <button type="button" className="primary-btn" onClick={() => handleCreateMilestone(goal.id)}>
                    Add milestone
                  </button>
                </div>
              </article>
            )
          })}

          {!loading && filteredGoals.length === 0 ? (
            <p className="muted">No goals in this view yet.</p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
