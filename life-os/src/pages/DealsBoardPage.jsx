import { useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const STAGES = ['lead', 'contacted', 'proposal', 'won', 'lost']

const STAGE_LABELS = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

function formatMoney(value, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(number)
}

function DealCard({ deal, onStageChange }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `deal-${deal.id}`,
    data: { type: 'deal', id: deal.id, stage: deal.stage },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <article ref={setNodeRef} style={style} className="deal-card" {...listeners} {...attributes}>
      <p className="task-title">{deal.title}</p>
      <p className="muted small-text">Client: {deal.client?.name || 'Unknown client'}</p>
      <p className="muted small-text">Value: {formatMoney(deal.value_amount, deal.currency || 'USD')}</p>
      <label className="deal-stage-inline">
        Stage
        <select value={deal.stage} onChange={(event) => onStageChange(deal.id, event.target.value)}>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </label>
      {deal.note ? <p className="muted small-text">{deal.note}</p> : null}
    </article>
  )
}

function StageColumn({ stage, deals, onStageChange }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage}`,
    data: { type: 'stage', stage },
  })

  return (
    <section ref={setNodeRef} className={`deal-column ${isOver ? 'deal-column-over' : ''}`}>
      <header className="deal-column-head">
        <p>{STAGE_LABELS[stage]}</p>
        <span>{deals.length}</span>
      </header>
      <div className="deal-column-body">
        {deals.length === 0 ? <p className="muted small-text">No deals</p> : null}
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onStageChange={onStageChange} />
        ))}
      </div>
    </section>
  )
}

export function DealsBoardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [deals, setDeals] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showDealModal, setShowDealModal] = useState(false)

  const [leadName, setLeadName] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadCity, setLeadCity] = useState('')
  const [leadIndustry, setLeadIndustry] = useState('')
  const [leadNote, setLeadNote] = useState('')

  const [dealTitle, setDealTitle] = useState('')
  const [dealStage, setDealStage] = useState('lead')
  const [dealClientId, setDealClientId] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [dealCurrency, setDealCurrency] = useState('USD')
  const [dealNextStepDate, setDealNextStepDate] = useState('')
  const [dealNote, setDealNote] = useState('')

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor))

  const loadData = async () => {
    setLoading(true)

    const [dealsResult, clientsResult] = await Promise.all([
      supabase
        .from('deals')
        .select('id, title, stage, value_amount, currency, next_step_date, note, created_at, client:clients(id, name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, name, phone, city, status, industry, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    const firstError = [dealsResult, clientsResult].find((item) => item.error)
    if (firstError) {
      setErrorMessage(firstError.error.message)
      setLoading(false)
      return
    }

    setDeals(dealsResult.data || [])
    setClients(clientsResult.data || [])
    if (!dealClientId && (clientsResult.data || []).length > 0) {
      setDealClientId(clientsResult.data[0].id)
    }
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [user.id])

  const dealsByStage = useMemo(() => {
    return STAGES.reduce((acc, stage) => {
      acc[stage] = deals.filter((deal) => deal.stage === stage)
      return acc
    }, {})
  }, [deals])

  const wonRevenue = useMemo(() => {
    return deals
      .filter((deal) => deal.stage === 'won')
      .reduce((sum, deal) => sum + Number(deal.value_amount || 0), 0)
  }, [deals])

  const openPipelineValue = useMemo(() => {
    return deals
      .filter((deal) => !['won', 'lost'].includes(deal.stage))
      .reduce((sum, deal) => sum + Number(deal.value_amount || 0), 0)
  }, [deals])

  const handleDragEnd = async (event) => {
    const activeId = event.active?.id
    const overId = event.over?.id

    if (!activeId || !overId) return

    const dealId = String(activeId).replace('deal-', '')
    const nextStage = String(overId).replace('stage-', '')

    if (!STAGES.includes(nextStage)) return

    const targetDeal = deals.find((deal) => deal.id === dealId)
    if (!targetDeal || targetDeal.stage === nextStage) return

    await handleDealStageChange(dealId, nextStage)
  }

  const handleDealStageChange = async (dealId, nextStage) => {
    if (!STAGES.includes(nextStage)) return

    const targetDeal = deals.find((deal) => deal.id === dealId)
    if (!targetDeal || targetDeal.stage === nextStage) return

    setDeals((prev) => prev.map((deal) => (deal.id === dealId ? { ...deal, stage: nextStage } : deal)))

    const { error } = await supabase.from('deals').update({ stage: nextStage }).eq('id', dealId)
    if (error) {
      setErrorMessage(error.message)
      await loadData()
    }
  }

  const handleCreateLead = async (event) => {
    event.preventDefault()
    if (!leadName.trim()) return

    const payload = {
      user_id: user.id,
      name: leadName.trim(),
      phone: leadPhone.trim() || null,
      city: leadCity.trim() || null,
      industry: leadIndustry.trim() || null,
      status: 'lead',
      note: leadNote.trim() || null,
    }

    const { error } = await supabase.from('clients').insert(payload)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setLeadName('')
    setLeadPhone('')
    setLeadCity('')
    setLeadIndustry('')
    setLeadNote('')
    setShowLeadModal(false)
    await loadData()
  }

  const handleCreateDeal = async (event) => {
    event.preventDefault()
    if (!dealTitle.trim() || !dealClientId) return

    const payload = {
      client_id: dealClientId,
      title: dealTitle.trim(),
      stage: dealStage,
      value_amount: dealValue ? Number(dealValue) : null,
      currency: dealCurrency.trim().toUpperCase() || null,
      next_step_date: dealNextStepDate || null,
      note: dealNote.trim() || null,
    }

    const { error } = await supabase.from('deals').insert(payload)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setDealTitle('')
    setDealStage('lead')
    setDealValue('')
    setDealCurrency('USD')
    setDealNextStepDate('')
    setDealNote('')
    setShowDealModal(false)
    await loadData()
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <main className="dashboard-layout deals-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Deals</p>
          <h1>Sales Pipeline</h1>
          <p className="muted">Drag cards between stages to keep your pipeline updated in real time.</p>
        </div>

        <div className="header-actions">
          <Link to="/dashboard" className="ghost-link">
            Back to dashboard
          </Link>
          <button type="button" className="ghost-action" onClick={() => setShowLeadModal(true)}>
            Quick add lead
          </button>
          <button type="button" className="primary-btn" onClick={() => setShowDealModal(true)}>
            Quick add deal
          </button>
          <button type="button" className="primary-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>

      {errorMessage ? <p className="message error">{errorMessage}</p> : null}
      {loading ? <p className="muted">Loading deals...</p> : null}

      {!loading ? (
        <section className="stats-grid finance-stats-grid">
          <article className="stat-card">
            <p className="muted small-text">Won deals revenue</p>
            <p className="stat-value">{formatMoney(wonRevenue, 'USD')}</p>
          </article>
          <article className="stat-card">
            <p className="muted small-text">Open pipeline value</p>
            <p className="stat-value">{formatMoney(openPipelineValue, 'USD')}</p>
          </article>
          <article className="stat-card">
            <p className="muted small-text">Total deals</p>
            <p className="stat-value">{deals.length}</p>
          </article>
          <article className="stat-card">
            <p className="muted small-text">Won count</p>
            <p className="stat-value">{dealsByStage.won?.length || 0}</p>
          </article>
        </section>
      ) : null}

      {!loading ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <section className="deals-board">
            {STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage] || []}
                onStageChange={handleDealStageChange}
              />
            ))}
          </section>
        </DndContext>
      ) : null}

      {showLeadModal ? (
        <div className="quick-modal-backdrop" role="presentation" onClick={() => setShowLeadModal(false)}>
          <div className="quick-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className="fitness-title">Quick Add Lead</h2>
            <form className="form-grid" onSubmit={handleCreateLead}>
              <label>
                Lead name
                <input value={leadName} onChange={(event) => setLeadName(event.target.value)} required />
              </label>
              <div className="quick-modal-row">
                <label>
                  Phone
                  <input
                    value={leadPhone}
                    onChange={(event) => setLeadPhone(event.target.value)}
                    placeholder="+1 555 123 4567"
                  />
                </label>
                <label>
                  City
                  <input
                    value={leadCity}
                    onChange={(event) => setLeadCity(event.target.value)}
                    placeholder="New York"
                  />
                </label>
              </div>
              <label>
                Industry
                <input
                  value={leadIndustry}
                  onChange={(event) => setLeadIndustry(event.target.value)}
                  placeholder="SaaS"
                />
              </label>
              <label>
                Note
                <input
                  value={leadNote}
                  onChange={(event) => setLeadNote(event.target.value)}
                  placeholder="Met through referral"
                />
              </label>
              <div className="quick-modal-actions">
                <button type="button" className="ghost-action" onClick={() => setShowLeadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Save lead
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showDealModal ? (
        <div className="quick-modal-backdrop" role="presentation" onClick={() => setShowDealModal(false)}>
          <div className="quick-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className="fitness-title">Quick Add Deal</h2>
            <form className="form-grid" onSubmit={handleCreateDeal}>
              <label>
                Deal title
                <input value={dealTitle} onChange={(event) => setDealTitle(event.target.value)} required />
              </label>
              <label>
                Client
                <select value={dealClientId} onChange={(event) => setDealClientId(event.target.value)} required>
                  <option value="">Choose client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="quick-modal-row">
                <label>
                  Stage
                  <select value={dealStage} onChange={(event) => setDealStage(event.target.value)}>
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Value
                  <input
                    type="number"
                    min="0"
                    value={dealValue}
                    onChange={(event) => setDealValue(event.target.value)}
                  />
                </label>
              </div>
              <div className="quick-modal-row">
                <label>
                  Currency
                  <input
                    value={dealCurrency}
                    onChange={(event) =>
                      setDealCurrency(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, '')
                          .slice(0, 3),
                      )
                    }
                    maxLength={3}
                  />
                </label>
                <label>
                  Next step date
                  <input
                    type="date"
                    value={dealNextStepDate}
                    onChange={(event) => setDealNextStepDate(event.target.value)}
                  />
                </label>
              </div>
              <label>
                Note
                <input value={dealNote} onChange={(event) => setDealNote(event.target.value)} />
              </label>
              <div className="quick-modal-actions">
                <button type="button" className="ghost-action" onClick={() => setShowDealModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Save deal
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mobile-quick-crm" aria-label="Quick CRM actions">
        <button type="button" className="quick-bar-btn" onClick={() => setShowLeadModal(true)}>
          + Lead
        </button>
        <button type="button" className="quick-bar-btn active" onClick={() => setShowDealModal(true)}>
          + Deal
        </button>
      </div>
    </main>
  )
}
