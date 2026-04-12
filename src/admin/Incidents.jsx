import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [imgUrl,    setImgUrl]    = useState(null)

  useEffect(() => {
    supabase
      .from('incidents')
      .select('*, drivers(name), riders(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setIncidents(data || [])
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <div className="a-page-header">
        <h1>Incidents</h1>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{incidents.length} report{incidents.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="a-card">
        <div className="a-table-wrap">
          {loading ? (
            <p className="a-empty">Loading…</p>
          ) : incidents.length === 0 ? (
            <p className="a-empty">No incidents reported</p>
          ) : (
            <table className="a-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Driver</th>
                  <th>Rider</th>
                  <th>Description</th>
                  <th>Photo</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(inc.created_at)}</td>
                    <td>{inc.drivers?.name || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>{inc.riders?.name  || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {inc.description}
                    </td>
                    <td>
                      {inc.image_url ? (
                        <button
                          className="a-btn a-btn-ghost a-btn-sm"
                          onClick={() => setImgUrl(inc.image_url)}
                        >
                          View Photo
                        </button>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Photo modal */}
      {imgUrl && (
        <div className="a-modal-backdrop" onClick={() => setImgUrl(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-header">
              Incident Photo
              <button className="a-modal-close" onClick={() => setImgUrl(null)}>✕</button>
            </div>
            <div className="a-modal-body" style={{ textAlign: 'center' }}>
              <img
                src={imgUrl}
                alt="Incident"
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
