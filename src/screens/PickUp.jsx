import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentPosition, reverseGeocode } from '../lib/geocode'

export default function PickUp({ trip, driver, onNext, onBack }) {
  const [arrived, setArrived] = useState(false)
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [pickupAddress, setPickupAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleArrived() {
    setError(null)
    setGpsStatus('locating')

    let position
    try {
      position = await getCurrentPosition()
      setGpsStatus('ok')
    } catch {
      setGpsStatus('error')
      setError('GPS unavailable — please enable location and try again.')
      return
    }

    const address = await reverseGeocode(position.lat, position.lon)
    setPickupAddress(address)

    const { error: dbErr } = await supabase
      .from('trips')
      .update({
        pickup_lat: position.lat,
        pickup_lon: position.lon,
        pickup_address: address,
        pickup_timestamp: new Date().toISOString(),
      })
      .eq('id', trip.id)

    if (dbErr) {
      setError(dbErr.message)
      setGpsStatus('idle')
      return
    }

    setArrived(true)

    // Fire rider notification — non-blocking, don't surface errors to driver
    supabase.functions.invoke('notify-rider', { body: { trip_id: trip.id } })
      .catch(console.error)
  }

  async function handleRiderIn() {
    setSaving(true)
    onNext()
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Pick Up</h1>
        <p>Trip #{trip.trip_number} · Driver: {driver.name}</p>
      </div>

      <div className="screen-body">
        {error && <p className="error-msg">{error}</p>}

        <div className="card">
          <div className="card-row">
            <span className="card-label">Started from</span>
            <span className="card-value">{trip.start_address}</span>
          </div>
        </div>

        {!arrived ? (
          <>
            {gpsStatus !== 'idle' && (
              <div className={`gps-status${gpsStatus === 'ok' ? ' ok' : gpsStatus === 'error' ? ' error' : ''}`}>
                {gpsStatus === 'locating' && <><div className="spinner spinner-dark" /> Getting GPS location…</>}
                {gpsStatus === 'ok' && <>✓ {pickupAddress}</>}
                {gpsStatus === 'error' && <>✗ GPS failed</>}
              </div>
            )}

            <button className="btn btn-outline" onClick={onBack}>
              ← Back to Trips
            </button>

            <button
              className="btn btn-primary"
              style={{ marginTop: 'auto' }}
              disabled={gpsStatus === 'locating'}
              onClick={handleArrived}
            >
              {gpsStatus === 'locating'
                ? <><div className="spinner" /> Getting location…</>
                : "📍 I've Arrived"}
            </button>
          </>
        ) : (
          <>
            <div className="gps-status ok">✓ Pickup: {pickupAddress}</div>

            <p style={{ fontSize: '1rem', color: 'var(--gray-600)', textAlign: 'center', padding: '8px 0' }}>
              Waiting for rider to get in the vehicle…
            </p>

            <button
              className="btn btn-green"
              style={{ marginTop: 'auto' }}
              disabled={saving}
              onClick={handleRiderIn}
            >
              {saving ? <><div className="spinner" /> …</> : '🚗 Rider Is In the Car →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
