import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import WeatherScreen from './WeatherScreen'
import { FEATURES, WEATHER_CONFIG } from '../lib/features'

const RVA_LAT = WEATHER_CONFIG.lat
const RVA_LON = WEATHER_CONFIG.lon

function weatherIcon(code) {
  const h = new Date().getHours()
  const night = h < 6 || h >= 20
  if (code === 0) return night ? '🌙' : '☀️'
  if (code <= 2) return night ? '🌙' : '⛅'
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

export default function SelectDriver({ onNext }) {
  const [drivers, setDrivers] = useState([])
  const [driverId, setDriverId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showWeather, setShowWeather] = useState(false)
  const weather = useWeather()

  useEffect(() => {
    supabase
      .from('drivers')
      .select('id, name')
      .eq('active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setDrivers(data || [])
        setLoading(false)
      })
  }, [])

  const selectedDriver = drivers.find((d) => d.id === driverId)

  return (
    <>
      {showWeather && <WeatherScreen onClose={() => setShowWeather(false)} />}

      <div className="screen">
        <div className="screen-header">
          <h1>Ride to Work RVA</h1>
          <p>Free Rides To Work — Driver App</p>
        </div>

        <div className="screen-body">
          {/* Weather widget — tap to expand (Rainy Day Module) */}
          {FEATURES.weather && (weather ? (
            <button
              onClick={() => setShowWeather(true)}
              style={{
                width: '100%',
                background: 'var(--gray-100)',
                border: '2px solid var(--gray-200)',
                borderRadius: 14,
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#111'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}
            >
              <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{weatherIcon(weather.code)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--gray-800)', lineHeight: 1 }}>
                  {weather.temp}°F
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginTop: 2 }}>
                  {weatherLabel(weather.code)} · Wind {weather.wind} mph
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 600 }}>
                TAP FOR MORE ›
              </span>
            </button>
          ) : (
            <div style={{
              background: 'var(--gray-100)',
              borderRadius: 14,
              padding: '14px 18px',
              fontSize: '0.85rem',
              color: 'var(--gray-400)',
            }}>
              Loading weather…
            </div>
          ))}

          {error && <p className="error-msg">{error}</p>}

          <div className="field">
            <label>Select Your Name</label>
            {loading ? (
              <p style={{ color: 'var(--gray-400)', fontSize: '0.95rem' }}>Loading drivers…</p>
            ) : (
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                <option value="">— Choose driver —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            className="btn btn-primary"
            disabled={!driverId}
            onClick={() => onNext(selectedDriver)}
            style={{ marginTop: 'auto' }}
          >
            Start Trips →
          </button>
        </div>
      </div>
    </>
  )
}
