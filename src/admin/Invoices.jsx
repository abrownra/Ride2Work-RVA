import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - day)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  return {
    start: sunday.toISOString().split('T')[0],
    end: saturday.toISOString().split('T')[0],
  }
}

export default function Invoices() {
  const [invoices, setInvoices]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [genError, setGenError]   = useState(null)

  const defaultBounds = getWeekBounds()
  const [weekStart, setWeekStart] = useState(defaultBounds.start)
  const [weekEnd, setWeekEnd]     = useState(defaultBounds.end)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    setInvoices(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    setGenError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await supabase.functions.invoke('generate-invoice', {
      body: { week_start: weekStart, week_end: weekEnd },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    setGenerating(false)
    if (resp.error || resp.data?.error) {
      setGenError(resp.data?.error || resp.error?.message || 'Generation failed')
    } else {
      setGenResult('Invoice generated and sent successfully!')
      load()
    }
  }

  return (
    <div>
      <div className="a-page-header">
        <h1>Invoices</h1>
      </div>

      {/* Manual generation */}
      <div className="a-card" style={{ marginBottom: 20 }}>
        <div className="a-card-header">Generate Invoice</div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="a-field-row">
            <div className="a-field">
              <label>Week Start (Sunday)</label>
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <div className="a-field">
              <label>Week End (Saturday)</label>
              <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
            </div>
          </div>
          {genError && <p className="a-error">{genError}</p>}
          {genResult && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#15803d', fontWeight: 600, fontSize: '0.9rem' }}>
              ✓ {genResult}
            </div>
          )}
          <button
            className="a-btn a-btn-primary"
            style={{ alignSelf: 'flex-start' }}
            onClick={handleGenerate}
            disabled={generating || !weekStart || !weekEnd}
          >
            {generating ? 'Generating…' : '⚡ Generate Now'}
          </button>
        </div>
      </div>

      {/* Invoice list */}
      <div className="a-card">
        <div className="a-card-header">Past Invoices</div>
        <div className="a-table-wrap">
          {loading ? (
            <p className="a-empty">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="a-empty">No invoices yet</p>
          ) : (
            <table className="a-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Week</th>
                  <th>Rides</th>
                  <th>Riders</th>
                  <th>Total</th>
                  <th>Sent</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono">#{inv.invoice_number}</td>
                    <td>{fmtDate(inv.week_start)} – {fmtDate(inv.week_end)}</td>
                    <td>{inv.total_rides ?? '—'}</td>
                    <td>{inv.total_riders ?? '—'}</td>
                    <td style={{ fontWeight: 700 }}>
                      {inv.total_amount != null ? `$${Number(inv.total_amount).toFixed(2)}` : '—'}
                    </td>
                    <td>
                      {inv.sent_at ? (
                        <span className="a-badge a-badge-green">Sent</span>
                      ) : (
                        <span className="a-badge a-badge-gray">Pending</span>
                      )}
                    </td>
                    <td>
                      {inv.pdf_url ? (
                        <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="a-btn a-btn-ghost a-btn-sm">
                          Download
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
