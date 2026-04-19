import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentPosition } from '../lib/geocode'
import HamburgerMenu from './HamburgerMenu'

function navUrl(address) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`
}

function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// Haversine distance in miles
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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
              fontSize: '0.78rem', fontWeight: 600, padding: '3px 8px', borderRadius: 6,
              background: statusBg, color: statusColor, flexShrink: 0,
            }}>
              {statusLabel}
            </span>
            {trip.start_address && (
              <span style={{ fontSize: '0.78rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {trip.start_address}
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a56db', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {actionLabel} →
        </div>
      </button>

      {(homeAddress || workAddress) && (
        <div style={{ borderTop: '1px solid #e5e7eb', display: 'flex' }}>
          {homeAddress && (
            <a
              href={navUrl(homeAddress)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '10px 8px', background: '#eff6ff',
                borderRight: workAddress ? '1px solid #dbeafe' : 'none',
                color: '#1a56db', fontWeight: 600, fontSize: '0.82rem',
                textDecoration: 'none', textAlign: 'center', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>📍</span>
              Home
            </a>
          )}
          {workAddress && (
            <a
              href={navUrl(workAddress)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '10px 8px', background: '#f0fdf4',
                color: '#15803d', fontWeight: 600, fontSize: '0.82rem',
                textDecoration: 'none', textAlign: 'center', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🏢</span>
              Work
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function PoolCard({ request, driverPos, onClaim, claiming }) {
  const dist = (driverPos && request.pickup_lat && request.pickup_lon)
    ? distanceMiles(driverPos.lat, driverPos.lon, request.pickup_lat, request.pickup_lon)
    : null

  const isNearby = dist !== null && dist < 5

  return (
    <div style={{
      background: '#fff',
      border: `2px solid ${isNearby ? '#86efac' : '#e5e7eb'}`,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937' }}>
            {request.riders?.name || 'Rider'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 2 }}>
            {fmtDateTime(request.pickup_time)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {dist !== null && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: isNearby ? '#dcfce7' : '#f1f5f9',
              color: isNearby ? '#15803d' : '#64748b',
            }}>
              {isNearby ? '📍 ' : ''}{dist.toFixed(1)} mi away
            </span>
          )}
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ flexShrink: 0 }}>📍</span>
          <span>{request.pickup_address}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ flexShrink: 0 }}>🏢</span>
          <span>{request.dropoff_address}</span>
        </div>
      </div>

      {request.notes && (
        <div style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
          Note: {request.notes}
        </div>
      )}

      <button
        className="btn btn-green"
        style={{ padding: '14px', fontSize: '1rem' }}
        onClick={() => onClaim(request)}
        disabled={claiming === request.id}
      >
        {claiming === request.id ? <><span className="spinner" /> Claiming…</> : 'Claim Ride'}
      </button>
    </div>
  )
}

export default function ActiveTrips({ driver, onNewTrip, onContinueTrip, onChangeDriver }) {
  const [trips,   setTrips]   = useState([])
  const [pool,    setPool]    = useState([])
  const [loading, setLoading] = useState(true)
  const [poolLoading, setPoolLoading] = useState(true)
  const [claiming, setClaiming] = useState(null)
  const [unclaiming, setUnclaiming] = useState(null)
  const [myClaimedRides, setMyClaimedRides] = useState([])
  const [driverPos, setDriverPos] = useState(null)
  const [tab, setTab] = useState('trips') // 'trips' | 'pool'
  const [claimError, setClaimError] = useState(null)

  const loadTrips = useCallback(async () => {
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

  const loadPool = useCallback(async () => {
    setPoolLoading(true)
    const [pendingRes, claimedRes] = await Promise.all([
      supabase.from('ride_requests').select('*, riders(name)').eq('status', 'pending').gte('pickup_time', new Date().toISOString()).order('pickup_time'),
      supabase.from('ride_requests').select('*, riders(name)').eq('status', 'claimed').eq('driver_id', driver.id).gte('pickup_time', new Date().toISOString()).order('pickup_time'),
    ])
    setPool(pendingRes.data || [])
    setMyClaimedRides(claimedRes.data || [])
    setPoolLoading(false)
  }, [driver.id])

  useEffect(() => {
    loadTrips()
    loadPool()
    // Get driver's current position for proximity
    getCurrentPosition()
      .then(setDriverPos)
      .catch(() => {})
  }, [loadTrips, loadPool])

  // Sort pool: nearby first, then by pickup time
  const sortedPool = [...pool].sort((a, b) => {
    if (!driverPos) return new Date(a.pickup_time) - new Date(b.pickup_time)
    const distA = (a.pickup_lat && a.pickup_lon)
      ? distanceMiles(driverPos.lat, driverPos.lon, a.pickup_lat, a.pickup_lon) : 999
    const distB = (b.pickup_lat && b.pickup_lon)
      ? distanceMiles(driverPos.lat, driverPos.lon, b.pickup_lat, b.pickup_lon) : 999
    return distA - distB
  })

  async function handleUnclaim(request) {
    setUnclaiming(request.id)

    // Delete the linked trip record
    await supabase.from('trips').delete().eq('ride_request_id', request.id)

    // Release back to pool
    await supabase.from('ride_requests').update({
      status: 'pending',
      driver_id: null,
      claimed_at: null,
    }).eq('id', request.id)

    // Notify admin
    supabase.functions.invoke('notify-ride-edit', {
      body: { ride_request_id: request.id, change_type: 'unclaimed' },
    }).catch(() => {})

    setUnclaiming(null)
    loadTrips()
    loadPool()
  }

  async function handleClaim(request) {
    setClaiming(request.id)

    // Optimistic: mark claimed in DB
    const { error } = await supabase
      .from('ride_requests')
      .update({
        status:     'claimed',
        driver_id:  driver.id,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', request.id)
      .eq('status', 'pending') // only if still pending (first come first served)

    if (error) {
      setClaiming(null)
      setClaimError('This ride was just claimed by another driver.')
      setTimeout(() => setClaimError(null), 4000)
      loadPool()
      return
    }

    // Create the trip record linked to this request
    await supabase.from('trips').insert({
      driver_id:        driver.id,
      rider_id:         request.rider_id,
      pickup_address:   request.pickup_address,
      pickup_lat:       request.pickup_lat,
      pickup_lon:       request.pickup_lon,
      dropoff_address:  request.dropoff_address,
      dropoff_lat:      request.dropoff_lat,
      dropoff_lon:      request.dropoff_lon,
      status:           'in_progress',
      rider_count:      1,
      ride_request_id:  request.id,
    })

    setClaiming(null)
    setTab('trips')
    loadTrips()
    loadPool()
  }

  const poolBadge = pool.length > 0
    ? <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', marginLeft: 5 }}>{pool.length}</span>
    : null

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
        <button className="btn btn-green" onClick={onNewTrip}>
          + Start New Trip
        </button>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, gap: 4 }}>
          {['trips', 'pool'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontWeight: 600, fontSize: '0.88rem',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#1f2937' : '#6b7280',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {t === 'trips' ? 'My Trips' : <><span>Ride Pool</span>{poolBadge}</>}
            </button>
          ))}
        </div>

        {/* My Trips tab */}
        {tab === 'trips' && (
          loading ? (
            <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px 0' }}>Loading trips…</p>
          ) : trips.length === 0 ? (
            <div style={{ background: '#f9fafb', border: '2px dashed #e5e7eb', borderRadius: 12, padding: '32px 20px', textAlign: 'center', color: 'var(--gray-400)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🚗</div>
              <p style={{ fontSize: '0.95rem' }}>No active trips</p>
              <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Tap "Start New Trip" or claim one from the Ride Pool</p>
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
          )
        )}

        {/* Ride Pool tab */}
        {tab === 'pool' && claimError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 14px', color: '#b91c1c', fontWeight: 600, fontSize: '0.9rem' }}>
            ⚠️ {claimError}
          </div>
        )}
        {tab === 'pool' && (
          poolLoading ? (
            <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px 0' }}>Loading pool…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* My claimed rides */}
              {myClaimedRides.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    My Claimed Rides
                  </p>
                  {myClaimedRides.map((r) => (
                    <div key={r.id} style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1f2937' }}>{r.riders?.name}</div>
                          <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{fmtDateTime(r.pickup_time)}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: '#dcfce7', color: '#15803d' }}>Claimed</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#4b5563' }}>
                        <div>📍 {r.pickup_address}</div>
                        <div>🏢 {r.dropoff_address}</div>
                      </div>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '10px', fontSize: '0.88rem', borderColor: '#ef4444', color: '#ef4444' }}
                        onClick={() => handleUnclaim(r)}
                        disabled={unclaiming === r.id}
                      >
                        {unclaiming === r.id ? <><span className="spinner" style={{ borderTopColor: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} /> Releasing…</> : 'Release Back to Pool'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Available pool */}
              {sortedPool.length === 0 ? (
                <div style={{ background: '#f9fafb', border: '2px dashed #e5e7eb', borderRadius: 12, padding: '32px 20px', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎯</div>
                  <p style={{ fontSize: '0.95rem' }}>No rides in the pool</p>
                  <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Check back later for new requests</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!driverPos && (
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' }}>
                      Enable location to see proximity to rides
                    </p>
                  )}
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {sortedPool.length} Ride{sortedPool.length !== 1 ? 's' : ''} Available
                    {driverPos ? ' — sorted by proximity' : ''}
                  </p>
                  {sortedPool.map((r) => (
                    <PoolCard key={r.id} request={r} driverPos={driverPos} onClaim={handleClaim} claiming={claiming} />
                  ))}
                </div>
              )}
            </div>
          )
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { loadTrips(); loadPool() }}>
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
