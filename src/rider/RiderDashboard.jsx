import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

const STATUS_STYLES = {
  pending:   { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  claimed:   { bg: '#f0fdf4', color: '#15803d', label: 'Driver Assigned' },
  completed: { bg: '#f1f5f9', color: '#64748b', label: 'Completed' },
  cancelled: { bg: '#fef2f2', color: '#b91c1c', label: 'Cancelled' },
}

export default function RiderDashboard({ rider, onRequest, onMyRides, onDetail, onLogout }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('rider_id', rider.id)
      .order('pickup_time', { ascending: false })
      .limit(20)
    setRequests(data || [])
    setLoading(false)
  }

  const upcoming = requests.filter(
    (r) => ['pending', 'claimed'].includes(r.status) && new Date(r.pickup_time) > new Date()
  )
  const past = requests.filter(
    (r) => !upcoming.includes(r)
  )
  const pendingCount = upcoming.filter((r) => r.status === 'pending').length
  const claimedCount = upcoming.filter((r) => r.status === 'claimed').length

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#111111', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Hi, {rider.name.split(' ')[0]}!</h1>
          <p>Ready to schedule a ride?</p>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            color: '#fff',
            fontSize: '0.8rem',
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>

      <div className="screen-body">
        <button className="btn btn-green" onClick={onRequest}>
          + Request a Ride
        </button>
        <button className="btn btn-outline" onClick={onMyRides}>
          📅 My Rides &amp; Schedule
        </button>

        {!loading && upcoming.length > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: '#fef3c7', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#92400e' }}>{pendingCount}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', marginTop: 2 }}>Waiting for Driver</div>
            </div>
            <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d' }}>{claimedCount}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d', marginTop: 2 }}>Driver Assigned</div>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <p className="section-title" style={{ marginBottom: 10 }}>Upcoming Rides</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {upcoming.map((r) => (
                    <RideCard key={r.id} ride={r} onClick={() => onDetail(r)} />
                  ))}
                </div>
              </div>
            )}

            {upcoming.length === 0 && (
              <div style={{
                background: '#f9fafb',
                border: '2px dashed var(--gray-200)',
                borderRadius: 12,
                padding: '32px 20px',
                textAlign: 'center',
                color: 'var(--gray-400)',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📅</div>
                <p style={{ fontSize: '0.95rem' }}>No upcoming rides</p>
                <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Tap "Request a Ride" to schedule one</p>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <p className="section-title" style={{ marginBottom: 10 }}>Past Rides</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {past.slice(0, 5).map((r) => (
                    <RideCard key={r.id} ride={r} onClick={() => onDetail(r)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RideCard({ ride, onClick }) {
  const s = STATUS_STYLES[ride.status] || STATUS_STYLES.pending

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: '#fff',
        border: '1px solid var(--gray-200)',
        borderRadius: 12,
        padding: '14px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gray-800)' }}>
          {fmtDateTime(ride.pickup_time)}
        </span>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600,
          padding: '3px 8px', borderRadius: 999,
          background: s.bg, color: s.color,
        }}>
          {s.label}
        </span>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span>📍 {ride.pickup_address}</span>
        <span>🏢 {ride.dropoff_address}</span>
      </div>
    </button>
  )
}
