const USER_AGENT = 'Ride2Work-RVA/1.0 (richmond-grant-app)'

export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': USER_AGENT } }
    )
    if (!res.ok) throw new Error('Nominatim error')
    const data = await res.json()
    const a = data.address || {}
    const parts = [
      a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road,
      a.city || a.town || a.village || a.county,
      a.state,
    ].filter(Boolean)
    return parts.length ? parts.join(', ') : data.display_name || `${lat}, ${lon}`
  } catch {
    return `${lat}, ${lon}`
  }
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  })
}
