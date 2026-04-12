import { useState } from 'react'
import { supabase } from '../lib/supabase'

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { start: monday.toISOString().split('T')[0], end: saturday.toISOString().split('T')[0] }
}

function getMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  return { start, end: getToday() }
}

function getSixMonthBounds() {
  const start = new Date()
  start.setMonth(start.getMonth() - 6)
  return { start: start.toISOString().split('T')[0], end: getToday() }
}

function getYearBounds() {
  const now = new Date()
  return { start: `${now.getFullYear()}-01-01`, end: getToday() }
}

const PRESETS = [
  { label: 'This Week',      title: 'Weekly Driver Report',        fn: getWeekBounds },
  { label: 'This Month',     title: 'Monthly Driver Report',       fn: getMonthBounds },
  { label: 'Last 6 Months',  title: 'Bi-Annual Driver Report',     fn: getSixMonthBounds },
  { label: 'This Year',      title: 'Annual Driver Report',        fn: getYearBounds },
]

export default function Reports() {
  const week = getWeekBounds()
  const [dateStart, setDateStart] = useState(week.start)
  const [dateEnd, setDateEnd]     = useState(week.end)
  const [reportTitle, setReportTitle] = useState('Weekly Driver Report')
  const [activePreset, setActivePreset] = useState(0)

  const [generating, setGenerating] = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)

  function applyPreset(idx) {
    const p = PRESETS[idx]
    const bounds = p.fn()
    setDateStart(bounds.start)
    setDateEnd(bounds.end)
    setReportTitle(p.title)
    setActivePreset(idx)
    setResult(null)
    setError(null)
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setResult(null)

    const { data, error: fnErr } = await supabase.functions.invoke('generate-invoice', {
      body: {
        date_start:   dateStart,
        date_end:     dateEnd,
        report_only:  true,
        report_title: reportTitle,
      },
    })

    setGenerating(false)

    if (fnErr)      { setError(fnErr.message || 'Generation failed'); return }
    if (data?.error){ setError(data.error);                           return }

    setResult(data)
  }

  return (
    <div>
      <div className="a-page-header">
        <h1>Reports</h1>
      </div>

      <div className="a-card" style={{ marginBottom: 24 }}>
        <div className="a-card-header">Select Report Period</div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                className={`a-btn ${activePreset === i ? 'a-btn-primary' : 'a-btn-ghost'}`}
                onClick={() => applyPreset(i)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="a-field-row" style={{ alignItems: 'flex-end' }}>
            <div className="a-field">
              <label>Start Date</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => { setDateStart(e.target.value); setActivePreset(null); setResult(null) }}
              />
            </div>
            <div className="a-field">
              <label>End Date</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => { setDateEnd(e.target.value); setActivePreset(null); setResult(null) }}
              />
            </div>
            <div className="a-field">
              <label>Report Title</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="e.g. Annual Driver Report"
              />
            </div>
          </div>

          <div>
            <button
              className="a-btn a-btn-primary"
              onClick={handleGenerate}
              disabled={generating || !dateStart || !dateEnd}
            >
              {generating ? 'Generating…' : 'Generate Report PDF'}
            </button>
          </div>

          {error && <p className="a-error">{error}</p>}

          {result && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 8,
              padding: '14px 18px',
            }}>
              <p style={{ fontWeight: 600, color: '#15803d', marginBottom: 10 }}>
                Report generated — {result.total_rides} trips · ${Number(result.total_amount).toFixed(2)}
              </p>
              <a
                href={result.report_url}
                target="_blank"
                rel="noreferrer"
                className="a-btn a-btn-primary"
              >
                Download PDF
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Reference card */}
      <div className="a-card">
        <div className="a-card-header">Report Types</div>
        <div style={{ padding: '20px' }}>
          <table className="a-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Period</th>
                <th>Use</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Weekly</td>
                <td>Monday – Saturday</td>
                <td>Paired with invoice sent to City of Richmond</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Monthly</td>
                <td>1st – today</td>
                <td>Month-to-date driver performance</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Bi-Annual</td>
                <td>Last 6 months</td>
                <td>Grant review periods, program summary</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Annual</td>
                <td>Jan 1 – today</td>
                <td>Year-end summary, grant reporting</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
