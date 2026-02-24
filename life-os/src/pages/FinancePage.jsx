import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'wallet', 'trading']
const CATEGORY_TYPES = ['income', 'expense']

function formatDate(value) {
  if (!value) return 'No date'
  return new Date(value).toLocaleDateString()
}

function formatMoney(value, currency = 'USD') {
  const number = Number(value || 0)
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(number)
}

export function FinancePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('bank')
  const [accountCurrency, setAccountCurrency] = useState('USD')

  const [categoryName, setCategoryName] = useState('')
  const [categoryType, setCategoryType] = useState('expense')

  const [amount, setAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')

  const [typeFilter, setTypeFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')

  const loadFinanceData = async () => {
    setLoading(true)

    const [accountsResult, categoriesResult, transactionsResult] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, type, currency, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('id, name, type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('id, amount, date, note, created_at, accounts(id, name, currency), categories(id, name, type)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    const firstError = [accountsResult, categoriesResult, transactionsResult].find((r) => r.error)
    if (firstError) {
      setErrorMessage(firstError.error.message)
      setLoading(false)
      return
    }

    setAccounts(accountsResult.data || [])
    setCategories(categoriesResult.data || [])
    setTransactions(transactionsResult.data || [])

    if (!selectedAccountId && (accountsResult.data || []).length > 0) {
      setSelectedAccountId(accountsResult.data[0].id)
    }

    if (!selectedCategoryId && (categoriesResult.data || []).length > 0) {
      setSelectedCategoryId(categoriesResult.data[0].id)
    }

    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadFinanceData()
  }, [user.id])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const categoryTypeValue = item.categories?.type || 'expense'
      const matchesType = typeFilter === 'all' || categoryTypeValue === typeFilter
      const matchesAccount = accountFilter === 'all' || item.accounts?.id === accountFilter
      const matchesMonth = monthFilter === 'all' || (item.date || '').startsWith(monthFilter)
      return matchesType && matchesAccount && matchesMonth
    })
  }, [transactions, typeFilter, accountFilter, monthFilter])

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((item) => item.categories?.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const expense = filteredTransactions
      .filter((item) => item.categories?.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    return {
      income,
      expense,
      balance: income - expense,
    }
  }, [filteredTransactions])

  const months = useMemo(() => {
    const values = Array.from(
      new Set(transactions.map((item) => (item.date || '').slice(0, 7)).filter(Boolean)),
    )
    return values.sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const monthlyChartData = useMemo(() => {
    const monthly = {}

    transactions.forEach((item) => {
      const month = (item.date || '').slice(0, 7)
      if (!month) return
      if (!monthly[month]) {
        monthly[month] = { month, income: 0, expense: 0 }
      }

      const amountValue = Number(item.amount || 0)
      if (item.categories?.type === 'income') {
        monthly[month].income += amountValue
      } else {
        monthly[month].expense += amountValue
      }
    })

    return Object.values(monthly)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((row) => ({
        ...row,
        label: new Date(`${row.month}-01`).toLocaleDateString(undefined, {
          month: 'short',
          year: '2-digit',
        }),
      }))
  }, [transactions])

  const netWorth = useMemo(() => {
    return accounts.reduce((sum, account) => {
      const accountTransactions = transactions.filter((item) => item.accounts?.id === account.id)
      const accountNet = accountTransactions.reduce((acc, item) => {
        const amountValue = Number(item.amount || 0)
        return item.categories?.type === 'income' ? acc + amountValue : acc - amountValue
      }, 0)
      return sum + accountNet
    }, 0)
  }, [accounts, transactions])

  const handleCreateAccount = async (event) => {
    event.preventDefault()
    if (!accountName.trim()) return
    setSaving(true)

    const { error } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: accountName.trim(),
      type: accountType,
      currency: accountCurrency.trim().toUpperCase() || 'USD',
    })

    setSaving(false)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setAccountName('')
    await loadFinanceData()
  }

  const handleCreateCategory = async (event) => {
    event.preventDefault()
    if (!categoryName.trim()) return
    setSaving(true)

    const { error } = await supabase.from('categories').insert({
      user_id: user.id,
      name: categoryName.trim(),
      type: categoryType,
    })

    setSaving(false)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setCategoryName('')
    await loadFinanceData()
  }

  const handleCreateTransaction = async (event) => {
    event.preventDefault()
    if (!selectedAccountId || !selectedCategoryId || !amount) return
    setSaving(true)

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: selectedAccountId,
      category_id: selectedCategoryId,
      amount: Number(amount),
      date: transactionDate,
      note: note.trim() || null,
    })

    setSaving(false)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setAmount('')
    setNote('')
    await loadFinanceData()
  }

  const handleDeleteTransaction = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await loadFinanceData()
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <main className="dashboard-layout finance-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Money Tracker</h1>
          <p className="muted">Manage accounts, categories, and transactions in one place.</p>
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

      <section className="stats-grid finance-stats-grid">
        <article className="stat-card">
          <p className="muted small-text">Income</p>
          <p className="stat-value">{formatMoney(summary.income)}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Expense</p>
          <p className="stat-value">{formatMoney(summary.expense)}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Balance</p>
          <p className="stat-value">{formatMoney(summary.balance)}</p>
        </article>
        <article className="stat-card">
          <p className="muted small-text">Net worth ticker</p>
          <p className="stat-value">{formatMoney(netWorth)}</p>
        </article>
      </section>

      <section className="panel finance-chart-panel">
        <div className="goal-widget-head">
          <p className="eyebrow">Player Stats</p>
          <p className="muted small-text">Monthly income vs expenses</p>
        </div>

        {monthlyChartData.length === 0 ? (
          <p className="muted">Add transactions to unlock finance analytics.</p>
        ) : (
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="label" stroke="#475569" />
                <YAxis stroke="#475569" />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Legend />
                <Bar dataKey="income" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="#b91c1c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="finance-grid">
        <section className="panel finance-sidebar">
          <form onSubmit={handleCreateAccount} className="form-grid compact-form">
            <h2 className="fitness-title">Accounts</h2>
            <label>
              Name
              <input
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Main bank"
                required
              />
            </label>
            <div className="task-form-row account-fields-row">
              <label>
                Type
                <select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
                  {ACCOUNT_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Currency
                <input
                  value={accountCurrency}
                  onChange={(event) =>
                    setAccountCurrency(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, '')
                        .slice(0, 3),
                    )
                  }
                  placeholder="USD"
                  maxLength={3}
                  className="currency-input"
                />
              </label>
            </div>
            <button className="primary-btn" type="submit" disabled={saving}>
              Add account
            </button>
          </form>

          <form onSubmit={handleCreateCategory} className="form-grid compact-form">
            <h2 className="fitness-title">Categories</h2>
            <label>
              Name
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Groceries"
                required
              />
            </label>
            <label>
              Type
              <select value={categoryType} onChange={(event) => setCategoryType(event.target.value)}>
                {CATEGORY_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-btn" type="submit" disabled={saving}>
              Add category
            </button>
          </form>
        </section>

        <section className="panel finance-main">
          <form onSubmit={handleCreateTransaction} className="form-grid compact-form">
            <h2 className="fitness-title">New Transaction</h2>
            <div className="finance-row">
              <label>
                Amount
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="120.50"
                  required
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(event) => setTransactionDate(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="finance-row">
              <label>
                Account
                <select
                  value={selectedAccountId}
                  onChange={(event) => setSelectedAccountId(event.target.value)}
                  required
                >
                  <option value="">Choose account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select
                  value={selectedCategoryId}
                  onChange={(event) => setSelectedCategoryId(event.target.value)}
                  required
                >
                  <option value="">Choose category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.type})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Note
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note"
              />
            </label>
            <button className="primary-btn" type="submit" disabled={saving}>
              Save transaction
            </button>
          </form>

          <div className="filter-row top-filter-row">
            {['all', ...CATEGORY_TYPES].map((item) => (
              <button
                key={item}
                type="button"
                className={`chip ${typeFilter === item ? 'chip-active' : ''}`}
                onClick={() => setTypeFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="advanced-filters">
            <label>
              Account filter
              <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
                <option value="all">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Month
              <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                <option value="all">All months</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {errorMessage ? <p className="message error">{errorMessage}</p> : null}
          {loading ? <p className="muted">Loading finance data...</p> : null}

          <div className="transactions-list">
            {filteredTransactions.map((item) => (
              <article key={item.id} className="transaction-item">
                <div>
                  <p className="task-title">{item.categories?.name || 'Category'}</p>
                  <p className="muted small-text">
                    {item.accounts?.name || 'Account'} - {formatDate(item.date)}
                  </p>
                  {item.note ? <p className="muted small-text">{item.note}</p> : null}
                </div>

                <div className="transaction-right">
                  <p
                    className={`transaction-amount ${item.categories?.type === 'income' ? 'income' : 'expense'}`}
                  >
                    {item.categories?.type === 'income' ? '+' : '-'}
                    {formatMoney(item.amount, item.accounts?.currency || 'USD')}
                  </p>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => handleDeleteTransaction(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}

            {!loading && filteredTransactions.length === 0 ? (
              <p className="muted">No transactions in this view yet.</p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  )
}
