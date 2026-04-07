import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = { name: '', phone: '', email: '', home_address: '', work_address: '', pickup_time: '', active: true }

export default function Riders() {
  const [riders, setRiders] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    const { data } = await supabase.from('riders').select('*').order('name')
    setRiders(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(EMPTY)
    setError(null)
    setModal({ mode: 'add' })
  }

  function openEdit(r) {
    setForm({
      name: r.name,
      phone: r.phone || '',
      email: r.email || '',
      home_address: r.home_address || '',
      work_address: r.work_address || '',
      pickup_time: r.pickup_time || '',
      active: r.active,
    })
    setError(null)
    setModal({ mode: 'edit', id: r.id })
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      home_address: form.home_address.trim() || null,
      work_address: form.work_address.trim() || null,
      pickup_time: form.pickup_time || null,
      active: form.active,
    }

    const { error } = modal.mode === 'add'
      ? await supabase.from('riders').insert(payload)
      : await supabase.from('riders').update(payload).eq('id', modal.id)

    if (error) { setError(error.message); setSaving(false); return }
    await load()
    setSaving(false)
    setModal(null)
  }

  async function toggleActive(r) {
    await supabase.from('riders').update({ active: !r.active }).eq('id', r.id)
    load()
  }

  function f(v) { return v || '—' }

  return (
    <div>
      <div className="a-page-header">
        <h1>Riders</h1>
        <button className="a-btn a-btn-primary" onClick={openAdd}>+ Add Rider</button>
      </div>

      <div className="a-card">
        <div className="a-table-wrap">
          {loading ? (
            <p className="a-empty">Loading…</p>
          ) : riders.length === 0 ? (
            <p className="a-empty">No riders yet</p>
          ) : (
            <table className="a-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Home Address</th>
                  <th>Work Address</th>
                  <th>Pickup Time</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{f(r.phone)}</td>
                    <td>{f(r.email)}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f(r.home_address)}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f(r.work_address)}</td>
                    <td>{f(r.pickup_time)}</td>
                    <td>
                      <span className={`a-badge ${r.active ? 'a-badge-green' : 'a-badge-gray'}`}>
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="a-btn a-btn-ghost a-btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="a-btn a-btn-ghost a-btn-sm" onClick={() => toggleActive(r)}>
                          {r.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="a-modal-backdrop" onClick={() => setModal(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-header">
              {modal.mode === 'add' ? 'Add Rider' : 'Edit Rider'}
              <button className="a-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              {error && <p className="a-error">{error}</p>}
              <div className="a-field">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="a-field-row">
                <div className="a-field">
                  <label>Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="a-field">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="a-field">
                <label>Home Address</label>
                <input value={form.home_address} onChange={(e) => setForm({ ...form, home_address: e.target.value })} />
              </div>
              <div className="a-field">
                <label>Work Address</label>
                <input value={form.work_address} onChange={(e) => setForm({ ...form, work_address: e.target.value })} />
              </div>
              <div className="a-field">
                <label>Preferred Pickup Time</label>
                <input type="time" value={form.pickup_time} onChange={(e) => setForm({ ...form, pickup_time: e.target.value })} />
              </div>
              <label className="a-toggle">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="a-modal-footer">
              <button className="a-btn a-btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="a-btn a-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
