import React, { useCallback, useEffect, useState } from 'react';
import { createShipment, deleteShipment, getShipments, updateShipmentStatus } from '../api';

const STATUSES = ['Draft', 'Booked', 'In Transit', 'Delayed', 'Delivered', 'Cancelled'];
const emptyForm = {
  cargo: '', origin: '', destination: '', weightTons: '', pickupDate: '', deliveryDate: '', notes: '',
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function Shipments() {
  const [shipments, setShipments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const response = await getShipments(params);
      setShipments(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Your session is invalid or expired. Log out and sign in again.');
      } else {
        setError(err.response?.data?.detail || 'Could not load shipments. Check that the backend and database are running.');
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { loadShipments(); }, [loadShipments]);

  const changeForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submitShipment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createShipment({ ...form, weightTons: Number(form.weightTons) });
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Shipment created successfully.');
      await loadShipments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create shipment. Check the required fields and backend connection.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (shipment, nextStatus) => {
    try {
      await updateShipmentStatus(shipment.id, nextStatus);
      setNotice(`${shipment.reference} updated to ${nextStatus}.`);
      await loadShipments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update shipment status.');
    }
  };

  const removeShipment = async (shipment) => {
    if (!window.confirm(`Delete shipment ${shipment.reference}? This cannot be undone.`)) return;
    try {
      await deleteShipment(shipment.id);
      setNotice(`${shipment.reference} deleted.`);
      await loadShipments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not delete shipment.');
    }
  };

  return (
    <section className="shipments-page">
      <div className="page-toolbar">
        <div><h2>Shipment register</h2><p className="subtitle">Create and manage your company's shipment records.</p></div>
        <button className="primary-btn toolbar-action" onClick={() => { setShowForm((value) => !value); setNotice(''); }}>+ New shipment</button>
      </div>

      {error && <div className="alert error-alert" role="alert">{error}</div>}
      {notice && <div className="alert success-alert" role="status">{notice}</div>}

      {showForm && (
        <form className="panel shipment-form" onSubmit={submitShipment}>
          <div className="panel-header"><div><h3>Create shipment</h3><p>All fields marked * are required.</p></div><button type="button" className="text-btn" onClick={() => setShowForm(false)}>Close</button></div>
          <div className="shipment-form-grid">
            <label>Cargo / goods *<input name="cargo" value={form.cargo} onChange={changeForm} required minLength="2" maxLength="120" placeholder="e.g. Electronics" /></label>
            <label>Weight (tonnes) *<input name="weightTons" type="number" min="0.01" step="0.01" value={form.weightTons} onChange={changeForm} required placeholder="e.g. 12.5" /></label>
            <label>Origin *<input name="origin" value={form.origin} onChange={changeForm} required minLength="2" placeholder="e.g. Delhi" /></label>
            <label>Destination *<input name="destination" value={form.destination} onChange={changeForm} required minLength="2" placeholder="e.g. Mumbai" /></label>
            <label>Pickup date *<input name="pickupDate" type="date" value={form.pickupDate} onChange={changeForm} required /></label>
            <label>Delivery date *<input name="deliveryDate" type="date" min={form.pickupDate || undefined} value={form.deliveryDate} onChange={changeForm} required /></label>
            <label className="full-field">Notes<input name="notes" value={form.notes} onChange={changeForm} maxLength="1000" placeholder="Optional handling or delivery notes" /></label>
          </div>
          <button className="primary-btn form-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create shipment'}</button>
        </form>
      )}

      <div className="shipment-summary">
        <div className="mini-stat"><span>Total shown</span><strong>{shipments.length}</strong></div>
        <div className="mini-stat"><span>In transit</span><strong>{shipments.filter((s) => s.status === 'In Transit').length}</strong></div>
        <div className="mini-stat"><span>Delivered</span><strong>{shipments.filter((s) => s.status === 'Delivered').length}</strong></div>
      </div>

      <div className="panel shipment-table-panel">
        <div className="filters">
          <input aria-label="Search shipments" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, route, or cargo…" />
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button className="outline-btn refresh-btn" onClick={loadShipments} type="button">Refresh</button>
        </div>

        {loading ? <p className="empty-state">Loading shipments…</p> : shipments.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">▣</span><h3>No shipments found</h3><p>Create your first shipment or change your search filters.</p><button className="outline-btn empty-action" onClick={() => setShowForm(true)}>Create first shipment</button></div>
        ) : (
          <div className="table-scroll">
            <table className="shipment-table">
              <thead><tr><th>Reference / Cargo</th><th>Route</th><th>Weight</th><th>Pickup</th><th>Delivery</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {shipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td><strong>{shipment.reference}</strong><small>{shipment.cargo}</small></td>
                    <td>{shipment.origin}<span className="route-arrow"> → </span>{shipment.destination}</td>
                    <td>{Number(shipment.weightTons).toLocaleString()} t</td>
                    <td>{formatDate(shipment.pickupDate)}</td>
                    <td>{formatDate(shipment.deliveryDate)}</td>
                    <td><span className={`status-pill status-${shipment.status.toLowerCase().replaceAll(' ', '-')}`}>{shipment.status}</span></td>
                    <td className="action-cell">
                      <select aria-label={`Change status for ${shipment.reference}`} value={shipment.status} onChange={(e) => changeStatus(shipment, e.target.value)}>
                        {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button className="delete-btn" type="button" onClick={() => removeShipment(shipment)} aria-label={`Delete ${shipment.reference}`}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
