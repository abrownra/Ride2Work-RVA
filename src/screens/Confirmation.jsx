import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Confirmation({ trip, driver, onNewTrip }) {
  const miles = trip.miles_traveled ?? 0
  const [driverPay, setDriverPay] = useState(null)

  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['rate_driver_pay', 'rate_driver_additional_rider'])
      .then(({ data }) => {
        const s = {}
        ;(data || []).forEach((r) => (s[r.key] = parseFloat(r.value)))
        const base = s.rate_driver_pay ?? 14
        const additional = s.rate_driver_additional_rider ?? 0
        const riderCount = trip.rider_count ?? 1
        setDriverPay(base + additional * (riderCount - 1))
      })
  }, [])

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: 'var(--green)' }}>
        <h1>Trip Complete!</h1>
        <p>Trip #{trip.trip_number}</p>
      </div>

      <div className="screen-body">
        <div className="success-icon">✓</div>

        <div className="card">
          <p className="section-title">Trip Summary</p>

          <div className="card-row">
            <span className="card-label">Driver</span>
            <span className="card-value">{driver.name}</span>
          </div>

          <div className="card-row">
            <span className="card-label">Pickup</span>
            <span className="card-value">{trip.pickup_address || trip.start_address}</span>
          </div>

          <div className="card-row">
            <span className="card-label">Drop-off</span>
            <span className="card-value">{trip.dropoff_address}</span>
          </div>

          <div className="card-row">
            <span className="card-label">Miles</span>
            <span className="card-value">{Number(miles).toFixed(1)}</span>
          </div>

          <div className="card-row">
            <span className="card-label">Riders</span>
            <span className="card-value">{trip.rider_count}</span>
          </div>

          <hr className="card-divider" />

          <div className="card-row">
            <span className="card-label">Your Pay</span>
            <span className="card-value card-total">
              {driverPay !== null ? `$${driverPay.toFixed(2)}` : '…'}
            </span>
          </div>
        </div>

        {trip.signature_url && (
          <div className="field">
            <label>Rider Signature</label>
            <img src={trip.signature_url} alt="Rider signature" className="sig-thumb" />
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={onNewTrip}
          style={{ marginTop: 'auto' }}
        >
          Back to Trips
        </button>
      </div>
    </div>
  )
}
