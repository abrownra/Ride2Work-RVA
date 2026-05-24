/**
 * Feature flags — flip `enabled` to true/false per client deployment.
 *
 * Tiered model example:
 *   Core tier:    all false  (base driver PWA + admin dashboard only)
 *   Standard tier: weather + offlineMode
 *   Pro tier:      all true
 *   Add-on:        any individual flag
 */
export const FEATURES = {
  weather:      false,  // Rainy Day Module        — weather widget + full-screen forecast
  liveBoard:    false,  // Master Key Module       — real-time active trips board (admin)
  leaderboard:  false,  // Master Key Module       — driver rankings on trip completion
  offlineMode:  true,   // Master Key Module       — offline trip queuing + auto-sync
  differential: false,  // Differential Module     — time/day-based surcharge pricing (locked — awaiting client payment)
}

/**
 * Per-client config for modules that need it.
 * Update coords + location name when deploying to a different city.
 */
export const WEATHER_CONFIG = {
  lat:      37.5407,
  lon:     -77.4360,
  location: 'Richmond, VA',
}
