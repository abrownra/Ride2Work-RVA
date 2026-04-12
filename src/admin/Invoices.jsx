import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInvoices(data || [])
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <div className="a-page-header">
        <h1>Invoices</h1>
      </div>


      <div className="a-card">
        <div className="a-table-wrap">
          {loading ? (
            <p className="a-empty">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="a-empty">No invoices yet — they'll appear here after the first Saturday auto-run</p>
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
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="a-btn a-btn-ghost a-btn-sm"
                        >
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
