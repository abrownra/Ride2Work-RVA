import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const TAB = { RIDERS: 'riders', DRIVERS: 'drivers', INCIDENT: 'incident' }

function ContactRow({ person }) {
  return (
    <div style={{
      padding: '14px 0',
      borderBottom: '1px solid #f3f4f6',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1f2937' }}>{person.name}</span>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {person.phone && (
          <a href={`tel:${person.phone}`} style={{ fontSize: '0.88rem', color: '#cc1111', textDecoration: 'none', fontWeight: 600 }}>
            📞 {person.phone}
          </a>
        )}
        {person.email && (
          <a href={`mailto:${person.email}`} style={{ fontSize: '0.88rem', color: '#cc1111', textDecoration: 'none', fontWeight: 600 }}>
            ✉ {person.email}
          </a>
        )}
        {!person.phone && !person.email && (
          <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No contact info</span>
        )}
      </div>
    </div>
  )
}

export default function HamburgerMenu({ driver }) {
  const [open, setOpen]       = useState(false)
  const [tab, setTab]         = useState(TAB.RIDERS)
  const [riders, setRiders]   = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)

  // Incident form
  const [desc, setDesc]             = useState('')
  const [riderId, setRiderId]       = useState('')
  const [image, setImage]           = useState(null)
  const [preview, setPreview]       = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      supabase.from('riders').select('id, name, phone, email').eq('active', true).order('name'),
      supabase.from('drivers').select('name, phone, email').eq('active', true).order('name'),
    ]).then(([r, d]) => {
      setRiders(r.data || [])
      setDrivers(d.data || [])
      setLoading(false)
    })
  }, [open])

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!desc.trim()) return
    setSubmitting(true)
    setError(null)

    let imageUrl = null
    if (image) {
      const ext  = image.name.split('.').pop() || 'jpg'
      const path = `incidents/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('incidents')
        .upload(path, image, { contentType: image.type })
      if (upErr) { setError(upErr.message); setSubmitting(false); return }
      const { data: urlData } = supabase.storage.from('incidents').getPublicUrl(path)
      imageUrl = urlData.publicUrl
    }

    const { error: dbErr } = await supabase.from('incidents').insert({
      driver_id:   driver?.id ?? null,
      rider_id:    riderId || null,
      description: desc.trim(),
      image_url:   imageUrl,
    })

    setSubmitting(false)
    if (dbErr) { setError(dbErr.message); return }

    setSubmitted(true)
    setDesc('')
    setRiderId('')
    setImage(null)
    setPreview(null)
    setTimeout(() => setSubmitted(false), 5000)
  }

  function close() {
    setOpen(false)
    setTab(TAB.RIDERS)
    setSubmitted(false)
    setError(null)
  }

  return (
    <>
      {/* Hamburger trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 10px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          alignSelf: 'flex-start',
          marginTop: 2,
        }}
      >
        <span style={{ width: 22, height: 2, background: '#fff', display: 'block', borderRadius: 2 }} />
        <span style={{ width: 22, height: 2, background: '#fff', display: 'block', borderRadius: 2 }} />
        <span style={{ width: 22, height: 2, background: '#fff', display: 'block', borderRadius: 2 }} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex' }}
          onClick={close}
        >
          {/* Dark backdrop */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.45)' }} />

          {/* Panel */}
          <div
            style={{
              width: '85vw',
              maxWidth: 380,
              background: '#fff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div style={{
              background: '#111111',
              padding: '20px 16px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>Menu</span>
              <button
                onClick={close}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: '1.2rem',
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid #f3f4f6' }}>
              {[
                { key: TAB.RIDERS,   label: 'Riders'   },
                { key: TAB.DRIVERS,  label: 'Drivers'  },
                { key: TAB.INCIDENT, label: 'Incident' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    flex: 1,
                    padding: '12px 4px',
                    border: 'none',
                    borderBottom: tab === t.key ? '3px solid #cc1111' : '3px solid transparent',
                    background: 'none',
                    fontSize: '0.85rem',
                    fontWeight: tab === t.key ? 700 : 500,
                    color: tab === t.key ? '#cc1111' : '#6b7280',
                    cursor: 'pointer',
                    marginBottom: -2,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, padding: '4px 16px 24px', overflowY: 'auto' }}>

              {/* Riders */}
              {tab === TAB.RIDERS && (
                loading
                  ? <p style={{ color: '#9ca3af', padding: '20px 0' }}>Loading…</p>
                  : riders.length === 0
                    ? <p style={{ color: '#9ca3af', padding: '20px 0' }}>No active riders</p>
                    : riders.map((r) => <ContactRow key={r.name} person={r} />)
              )}

              {/* Drivers */}
              {tab === TAB.DRIVERS && (
                loading
                  ? <p style={{ color: '#9ca3af', padding: '20px 0' }}>Loading…</p>
                  : drivers.length === 0
                    ? <p style={{ color: '#9ca3af', padding: '20px 0' }}>No active drivers</p>
                    : drivers.map((d) => <ContactRow key={d.name} person={d} />)
              )}

              {/* Report Incident */}
              {tab === TAB.INCIDENT && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    Describe the incident. Admin will be notified.
                  </p>

                  {submitted && (
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: '#15803d',
                      fontWeight: 600,
                      fontSize: '0.92rem',
                    }}>
                      Incident reported. Admin has been notified.
                    </div>
                  )}

                  {error && (
                    <div style={{
                      background: '#fef2f2',
                      border: '1px solid #fca5a5',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: '#b91c1c',
                      fontSize: '0.88rem',
                    }}>
                      {error}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Rider Involved (optional)
                    </label>
                    <select
                      value={riderId}
                      onChange={(e) => setRiderId(e.target.value)}
                      style={{ width: '100%', padding: '12px 14px', fontSize: '1rem', border: '2px solid #e5e7eb', borderRadius: 10, background: '#fff', appearance: 'none', outline: 'none' }}
                    >
                      <option value="">— Select rider —</option>
                      {riders.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      What happened? *
                    </label>
                    <textarea
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      placeholder="Describe the incident in detail…"
                      rows={5}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '1rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: 10,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Photo (optional)
                    </label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                    />
                    {preview ? (
                      <div style={{ position: 'relative' }}>
                        <img
                          src={preview}
                          alt="Incident"
                          style={{ width: '100%', borderRadius: 10, border: '2px solid #e5e7eb', maxHeight: 200, objectFit: 'cover' }}
                        />
                        <button
                          onClick={() => { setImage(null); setPreview(null) }}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            borderRadius: 6,
                            color: '#fff',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        style={{
                          padding: '14px',
                          border: '2px dashed #d1d5db',
                          borderRadius: 10,
                          background: '#f9fafb',
                          color: '#6b7280',
                          fontSize: '0.92rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        📷 Take Photo or Choose File
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !desc.trim()}
                    style={{
                      padding: '18px',
                      background: submitting || !desc.trim() ? '#9ca3af' : '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      cursor: submitting || !desc.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Submitting…' : 'Submit Incident Report'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
