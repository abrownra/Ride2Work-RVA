import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import WeatherScreen from '../screens/WeatherScreen'
import { FEATURES, WEATHER_CONFIG } from '../lib/features'

const RVA_LAT = WEATHER_CONFIG.lat
const RVA_LON = WEATHER_CONFIG.lon

function weatherIcon(code) {
  const h = new Date().getHours()
  const night = h < 6 || h >= 20
  if (code === 0) return night ? '🌙' : '☀️'
  if (code <= 2) return '⛅'
  if (code <= 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 55) return '🌦️'
  if (code <= 65) return '🌧️'
  if (code <= 75) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 99) return '⛈️'
  return '🌡️'
}

function weatherLabel(code) {
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly Cloudy'
  if (code <= 3) return 'Overcast'
  if (code <= 48) return 'Foggy'
  if (code <= 55) return 'Drizzle'
  if (code <= 65) return 'Rain'
  if (code <= 75) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}

function useWeather() {
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    if (!FEATURES.weather) return
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${RVA_LAT}&longitude=${RVA_LON}` +
      `&current=temperature_2m,weather_code,wind_speed_10m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph`
    )
      .then((r) => r.json())
      .then((d) => {
        const c = d.current
        setWeather({
          temp: Math.round(c.temperature_2m),
          code: c.weather_code,
          wind: Math.round(c.wind_speed_10m),
        })
      })
      .catch(() => {})
  }, [])
  return weather
}

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - day)
  sunday.setHours(0, 0, 0, 0)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  saturday.setHours(23, 59, 59, 999)
  return { start: sunday.toISOString(), end: saturday.toISOString() }
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [byDriver, setByDriver] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWeather, setShowWeather] = useState(false)
  const weather = useWeather()

  useEffect(() => {
    async function load() {
      const { start, end } = getWeekBounds()

      const { data: trips } = await supabase
        .from('trips')
        .select('id, rider_count, trip_total, driver_id, status, drivers(name)')
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end)

      const { data: allTrips } = await supabase
        .from('trips')
        .select('id')
        .eq('status', 'completed')

      const t = trips || []
      const totalRides = t.length
      const totalRiders = t.reduce((s, r) => s + (r.rider_count || 1), 0)
      const totalAmount = t.reduce((s, r) => s + (r.trip_total || 0), 0)

      // Group by driver
      const map = {}
      t.forEach((trip) => {
        const name = trip.drivers?.name || 'Unknown'
        if (!map[name]) map[name] = { rides: 0, amount: 0 }
        map[name].rides += 1
        map[name].amount += trip.trip_total || 0
      })
      const driverRows = Object.entries(map)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.rides - a.rides)

      setStats({ totalRides, totalRiders, totalAmount, allTime: (allTrips || []).length })
      setByDriver(driverRows)
      setLoading(false)
    }
    load()
  }, [])

  const maxRides = byDriver.length ? Math.max(...byDriver.map((d) => d.rides)) : 1

  return (
    <div>
      {showWeather && <WeatherScreen onClose={() => setShowWeather(false)} />}

      <div className="a-page-header">
        <h1>Dashboard</h1>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>This Week</span>
      </div>

      {/* Weather widget (Rainy Day Module) */}
      {FEATURES.weather && weather && (
        <button
          onClick={() => setShowWeather(true)}
          style={{
            width: '100%',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '12px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
            marginBottom: 16,
            transition: 'border-color 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#94a3b8'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{weatherIcon(weather.code)}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
              {weather.temp}°F
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: 8 }}>
              {weatherLabel(weather.code)} · Wind {weather.wind} mph
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>EXPAND ›</span>
        </button>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      ) : (
        <>
          <div className="a-stat-grid">
            <div className="a-stat-card">
              <div className="a-stat-label">Rides This Week</div>
              <div className="a-stat-val">{stats.totalRides}</div>
            </div>
            <div className="a-stat-card">
              <div className="a-stat-label">Riders This Week</div>
              <div className="a-stat-val">{stats.totalRiders}</div>
            </div>
            <div className="a-stat-card">
              <div className="a-stat-label">Amount This Week</div>
              <div className="a-stat-val">${stats.totalAmount.toFixed(2)}</div>
            </div>
            <div className="a-stat-card">
              <div className="a-stat-label">All-Time Rides</div>
              <div className="a-stat-val">{stats.allTime}</div>
            </div>
          </div>

          <div className="a-card">
            <div className="a-card-header">Rides by Driver — This Week</div>
            {byDriver.length === 0 ? (
              <p className="a-empty">No completed trips this week</p>
            ) : (
              <div className="a-bar-chart">
                {byDriver.map((d) => (
                  <div key={d.name} className="a-bar-row">
                    <span className="a-bar-name" title={d.name}>{d.name}</span>
                    <div className="a-bar-track">
                      <div
                        className="a-bar-fill"
                        style={{ width: `${(d.rides / maxRides) * 100}%` }}
                      />
                    </div>
                    <span className="a-bar-val">{d.rides} · ${d.amount.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
