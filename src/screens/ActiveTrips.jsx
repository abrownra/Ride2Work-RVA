import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import HamburgerMenu from './HamburgerMenu'

function navUrl(address) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`
}

function TripCard({ trip, onTap }) {
  const hasPickup  = !!trip.pickup_timestamp
  const hasDropoff = !!trip.dropoff_timestamp

  let statusLabel, statusBg, statusColor, actionLabel
  if (!hasPickup) {
    statusLabel = 'On My Way'
    statusBg    = '#eff6ff'
    statusColor = '#1a56db'
    actionLabel = 'Arrive & Pick Up'
  } else if (!hasDropoff) {
    statusLabel = 'Rider On Board'
    statusBg    = '#f0fdf4'
    statusColor = '#057a55'
    actionLabel = 'Drop Off'
  } else {
    statusLabel = 'Completed'
    statusBg    = '#f3f4f6'
    statusColor = '#6b7280'
    actionLabel = 'View'
  }

  const homeAddress = trip.riders?.home_address
  const workAddress = trip.riders?.work_address

  return (
    <div style={{
      background: '#fff',
      border: '2px solid #e5e7eb',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Main tap area */}
      <button
        onClick={() => onTap(trip)}
        style={{
          width: '100%',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          textAlign: 'left',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>
            {trip.riders?.name || 'Unknown Rider'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 6,
              background: statusBg,
              color: statusColor,
              flexShrink: 0,
            }}>
              {statusLabel}
            </span>
            {trip.start_address && (
              <span style={{
                fontSize: '0.78rem',
                color: '#9ca3af',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {trip.start_address}
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a56db', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {actionLabel} →
        </div>
      </button>

      {/* Navigation buttons — always show both when addresses available */}
      {(homeAddress || workAddress) && (
        <div style={{ borderTop: '1px solid #e5e7eb', display: 'flex' }}>
          {homeAddress && (
            <a
              href={navUrl(homeAddress)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '10px 8px',
                background: '#eff6ff',
                borderRight: workAddress ? '1px solid #dbeafe' : 'none',
                color: '#1a56db',
                fontWeight: 600,
                fontSize: '0.82rem',
                textDecoration: 'none',
                textAlign: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>📍</span>
              Home
              <span style={{ fontSize: '0.72rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {homeAddress}
              </span>
            </a>
          )}
          {workAddress && (
            <a
              href={navUrl(workAddress)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '10px 8px',
                background: '#f0fdf4',
                color: '#15803d',
                fontWeight: 600,
                fontSize: '0.82rem',
                textDecoration: 'none',
                textAlign: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🏢</span>
              Work
              <span style={{ fontSize: '0.72rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {workAddress}
              </span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function ActiveTrips({ driver, onNewTrip, onContinueTrip, onChangeDriver }) {
  const [trips,   setTrips]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('trips')
      .select('*, riders(name, home_address, work_address, phone)')
      .eq('driver_id', driver.id)
      .eq('status', 'in_progress')
      .order('created_at')
    setTrips(data || [])
    setLoading(false)
  }, [driver.id])

  useEffect(() => { load() }, [load])

  return (
    <div className="screen">
      <div className="screen-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Active Trips</h1>
          <p>Driver: {driver.name}</p>
        </div>
        <HamburgerMenu driver={driver} />
      </div>

      <div className="screen-body">
        <button className="btn btn-primary" onClick={onNewTrip}>
          + Start New Trip
        </button>

        {loading ? (
          <p style={{ color: 'var(--gray-400)', fontSize: '0.95rem', textAlign: 'center', padding: '20px 0' }}>
            Loading trips…
          </p>
        ) : trips.length === 0 ? (
          <div style={{
            background: '#f9fafb',
            border: '2px dashed #e5e7eb',
            borderRadius: 12,
            padding: '32px 20px',
            textAlign: 'center',
            color: 'var(--gray-400)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🚗</div>
            <p style={{ fontSize: '0.95rem' }}>No active trips</p>
            <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Tap "Start New Trip" above</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {trips.length} Active Trip{trips.length !== 1 ? 's' : ''} — tap to continue
            </p>
            {trips.map((t) => (
              <TripCard key={t.id} trip={t} onTap={onContinueTrip} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={load}>
            Refresh
          </button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onChangeDriver}>
            ← Change Driver
          </button>
        </div>
      </div>
    </div>
  )
}
