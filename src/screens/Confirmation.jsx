export default function Confirmation({ trip, driver, onNewTrip }) {
  const miles = trip.miles_traveled ?? 0
  const total = trip.trip_total ?? 0
  const rate = trip.rate_applied ?? 0

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

          <div className="card-row">
            <span className="card-label">Rate</span>
            <span className="card-value">${Number(rate).toFixed(2)}</span>
          </div>

          <hr className="card-divider" />

          <div className="card-row">
            <span className="card-label">Trip Total</span>
            <span className="card-value card-total">${Number(total).toFixed(2)}</span>
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
          Start New Trip
        </button>
      </div>
    </div>
  )
}
