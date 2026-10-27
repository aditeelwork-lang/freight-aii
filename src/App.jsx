import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getShipments } from './api';
import Auth from './components/Auth';
import Shipments from './components/Shipments';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import './App.css';

const navItems = [
  { id: 'overview', icon: '◫', label: 'Overview' },
  { id: 'shipments', icon: '▣', label: 'Shipments' },
  { id: 'marketplace', icon: '⇄', label: 'Marketplace' },
  { id: 'forecast', icon: '⌁', label: 'AI Forecast' },
];
const STATUSES = ['Draft', 'Booked', 'In Transit', 'Delayed', 'Delivered', 'Cancelled'];
const COLORS = ['#4ca7ff', '#a987ff', '#40d993', '#ffad52', '#fb7185', '#8795a8'];
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function Overview({ shipments, onOpenShipments, onRefresh, loading }) {
  const total = shipments.length;
  const transit = shipments.filter((s) => s.status === 'In Transit').length;
  const delivered = shipments.filter((s) => s.status === 'Delivered').length;
  const attention = shipments.filter((s) => s.status === 'Delayed').length;
  const totalWeight = shipments.reduce((sum, s) => sum + (Number(s.weightTons) || 0), 0);
  const statusData = STATUSES.map((name) => ({ name, value: shipments.filter((s) => s.status === name).length })).filter((s) => s.value > 0);
  const routeData = Object.entries(shipments.reduce((acc, s) => { const route = `${s.origin || '?'} → ${s.destination || '?'}`; acc[route] = (acc[route] || 0) + 1; return acc; }, {})).map(([route, count]) => ({ route, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  const recent = [...shipments].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 5);
  return <>
    <div className="welcome-banner"><div><p className="eyebrow">OPERATIONS SNAPSHOT</p><h2>Move freight with more clarity.</h2><p>Track your loads, spot delays, and keep every shipment moving from one workspace.</p></div><button className="primary-btn" onClick={onOpenShipments}>+ Create shipment</button></div>
    <div className="kpi-grid">
      <Kpi label="Total shipments" value={total} icon="▣" tone="blue" foot="Across your workspace" />
      <Kpi label="In transit" value={transit} icon="↗" tone="purple" foot={`${total ? Math.round(transit / total * 100) : 0}% of all shipments`} />
      <Kpi label="Delivered" value={delivered} icon="✓" tone="green" foot="Successfully completed" />
      <Kpi label="Needs attention" value={attention} icon="!" tone="orange" foot="Delayed shipments" />
    </div>
    <div className="kpi-grid secondary-kpis">
      <Kpi label="Cargo moved" value={`${totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} t`} icon="⚖" tone="blue" foot="Total recorded weight" />
      <Kpi label="On-time signal" value={`${total ? Math.round((total - attention) / total * 100) : 100}%`} icon="◷" tone="green" foot="Not marked delayed · indicative" />
      <Kpi label="Active routes" value={new Set(shipments.map(s => `${s.origin}|${s.destination}`)).size} icon="⇄" tone="purple" foot="Unique origin-destination pairs" />
      <div className="kpi-card sync-card"><div className="kpi-top">Data connection <span className="kpi-icon green">●</span></div><h2 className="sync-value">{loading ? 'Syncing…' : 'Ready'}</h2><button className="text-btn" onClick={onRefresh}>Refresh data ↻</button></div>
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-header"><div><h3>Shipment status</h3><p>Current operational mix</p></div><span className="chart-label">LIVE DATA</span></div>
        {statusData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3}>{statusData.map((entry) => <Cell key={entry.name} fill={COLORS[STATUSES.indexOf(entry.name)]} />)}</Pie><Tooltip contentStyle={{ background: '#111c29', border: '1px solid #263548', borderRadius: 8, color: '#f4f7fb' }} /></PieChart></ResponsiveContainer><div className="chart-legend">{statusData.map((s) => <span key={s.name}><i style={{ background: COLORS[STATUSES.indexOf(s.name)] }} />{s.name}<strong>{s.value}</strong></span>)}</div></div> : <EmptyChart text="Create shipments to see status analytics." />}
      </section>
      <section className="panel chart-panel"><div className="panel-header"><div><h3>Top routes</h3><p>Shipment count by route</p></div></div>
        {routeData.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={routeData} layout="vertical" margin={{ left: 0, right: 16 }}><CartesianGrid stroke="#223044" horizontal={false} /><XAxis type="number" allowDecimals={false} stroke="#718096" fontSize={11} /><YAxis type="category" dataKey="route" width={130} stroke="#a5b2c5" fontSize={10} /><Tooltip contentStyle={{ background: '#111c29', border: '1px solid #263548', borderRadius: 8, color: '#f4f7fb' }} /><Bar dataKey="count" name="Shipments" fill="#4ca7ff" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart text="Route analytics appear when shipments are added." />}
      </section>
    </div>
    <section className="panel recent-panel"><div className="panel-header"><div><h3>Recent shipments</h3><p>Your latest shipment records</p></div><button className="outline-btn" onClick={onOpenShipments}>View all</button></div>
      {recent.length ? <div className="table-scroll"><table className="shipment-table"><thead><tr><th>Reference / Cargo</th><th>Route</th><th>Weight</th><th>Status</th></tr></thead><tbody>{recent.map(s => <tr key={s.id}><td><strong>{s.reference || 'Unreferenced'}</strong><small>{s.cargo}</small></td><td>{s.origin} <span className="route-arrow">→</span> {s.destination}</td><td>{Number(s.weightTons || 0).toLocaleString()} t</td><td><span className={`status-pill status-${String(s.status || 'Draft').toLowerCase().replaceAll(' ', '-')}`}>{s.status || 'Draft'}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>No shipments yet</h3><p>Create your first shipment to populate your operations dashboard.</p><button className="primary-btn" onClick={onOpenShipments}>Create shipment</button></div>}
    </section>
  </>;
}
function Kpi({ label, value, icon, tone, foot }) { return <article className="kpi-card"><div className="kpi-top">{label}<span className={`kpi-icon ${tone}`}>{icon}</span></div><h2>{value}</h2><p className="kpi-foot">{foot}</p></article>; }
function EmptyChart({ text }) { return <div className="empty-chart"><span>▥</span><p>{text}</p></div>; }

function Marketplace({ shipments, onOpenShipments }) {
  const [origin, setOrigin] = useState(''); const [destination, setDestination] = useState(''); const [weight, setWeight] = useState('10'); const [cargo, setCargo] = useState('General cargo');
  const [quoted, setQuoted] = useState(false);
  const estimate = useMemo(() => { const tonnes = Math.max(0, Number(weight) || 0); const distanceFactor = (origin.trim().toLowerCase() === destination.trim().toLowerCase() && origin && destination) ? 0.7 : 1; return Math.round(tonnes * 1850 * distanceFactor + 4500); }, [origin, destination, weight]);
  return <><div className="welcome-banner"><div><p className="eyebrow">FREIGHT MARKETPLACE</p><h2>Plan a load and estimate a quote.</h2><p>Use this quick estimator to prepare a demo quote. It is an indicative calculation, not a live carrier offer.</p></div><span className="feature-badge">QUOTE ESTIMATOR</span></div>
    <div className="market-grid"><section className="panel form-panel"><div className="panel-header"><div><h3>Build a freight request</h3><p>Enter shipment details to estimate a budget.</p></div></div><form className="shipment-form compact-form" onSubmit={e => { e.preventDefault(); setQuoted(true); }}><div className="shipment-form-grid"><label>Origin<input required value={origin} onChange={e => { setOrigin(e.target.value); setQuoted(false); }} placeholder="e.g. Delhi" /></label><label>Destination<input required value={destination} onChange={e => { setDestination(e.target.value); setQuoted(false); }} placeholder="e.g. Mumbai" /></label><label>Cargo type<input required value={cargo} onChange={e => { setCargo(e.target.value); setQuoted(false); }} /></label><label>Weight (tonnes)<input required type="number" min="0.1" step="0.1" value={weight} onChange={e => { setWeight(e.target.value); setQuoted(false); }} /></label></div><button className="primary-btn form-submit">Estimate freight cost</button></form></section>
      <section className="panel quote-panel"><p className="eyebrow">INDICATIVE ESTIMATE</p><div className="quote-price">{money(estimate)}</div><p className="subtitle">For {weight || 0} tonnes · {cargo || 'General cargo'}</p><div className="quote-line"><span>Base logistics estimate</span><strong>{money(Math.round(estimate * .82))}</strong></div><div className="quote-line"><span>Handling & buffer</span><strong>{money(estimate - Math.round(estimate * .82))}</strong></div><p className="disclaimer">Estimate only. Actual rates vary by distance, vehicle, fuel, season, and carrier.</p>{quoted && <div className="alert success-alert">Estimate prepared. Create a shipment to store this load in your register.</div>}<button className="outline-btn" onClick={onOpenShipments}>Open shipment register</button></section></div>
    <section className="panel recent-panel"><div className="panel-header"><div><h3>Recent freight activity</h3><p>Existing loads from your shipment register</p></div><span className="chart-label">{shipments.length} LOADS</span></div>{shipments.length ? <div className="route-cards">{shipments.slice(0, 6).map(s => <article key={s.id} className="route-card"><span className="route-card-icon">⇄</span><strong>{s.origin} → {s.destination}</strong><span>{s.cargo} · {s.weightTons} t</span><small>{s.status || 'Draft'}</small></article>)}</div> : <EmptyChart text="Your saved shipments will appear here." />}</section></>;
}

function Forecast({ shipments, onOpenShipments }) {
  const delayed = shipments.filter(s => s.status === 'Delayed').length;
  const inTransit = shipments.filter(s => s.status === 'In Transit').length;
  const delivered = shipments.filter(s => s.status === 'Delivered').length;
  const risk = shipments.length ? Math.round(delayed / shipments.length * 100) : 0;
  const cargoTotals = Object.entries(shipments.reduce((acc, s) => { acc[s.cargo || 'Other'] = (acc[s.cargo || 'Other'] || 0) + (Number(s.weightTons) || 0); return acc; }, {})).map(([cargo, tonnes]) => ({ cargo, tonnes: Math.round(tonnes * 10) / 10 })).sort((a, b) => b.tonnes - a.tonnes).slice(0, 6);
  const recommendations = [];
  if (delayed) recommendations.push({ tone: 'warning', title: 'Review delayed loads', detail: `${delayed} shipment${delayed === 1 ? '' : 's'} marked delayed. Confirm carrier ETA and notify the receiving contact.` });
  if (inTransit) recommendations.push({ tone: 'info', title: 'Monitor in-transit freight', detail: `${inTransit} active load${inTransit === 1 ? '' : 's'} may benefit from a scheduled status update.` });
  if (!shipments.length) recommendations.push({ tone: 'info', title: 'Add shipment history', detail: 'Forecast signals will become more useful as real shipment records accumulate.' });
  if (shipments.length && !delayed) recommendations.push({ tone: 'good', title: 'No delayed loads recorded', detail: 'Your register currently has no shipments marked Delayed. Keep status updates current.' });
  return <><div className="welcome-banner"><div><p className="eyebrow">OPERATIONS INTELLIGENCE</p><h2>Signals from your shipment data.</h2><p>Transparent, rule-based operational indicators from your current records — not a trained machine-learning prediction.</p></div><span className="feature-badge">RULE-BASED INSIGHTS</span></div>
    <div className="kpi-grid"><Kpi label="Delay share" value={`${risk}%`} icon="!" tone={risk ? 'orange' : 'green'} foot="Loads marked delayed" /><Kpi label="In transit now" value={inTransit} icon="↗" tone="blue" foot="Require status monitoring" /><Kpi label="Delivered loads" value={delivered} icon="✓" tone="green" foot="Recorded completions" /><Kpi label="Data sample" value={shipments.length} icon="▤" tone="purple" foot="Shipment records analyzed" /></div>
    <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-header"><div><h3>Cargo weight mix</h3><p>Recorded tonnes by cargo type</p></div></div>{cargoTotals.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={cargoTotals} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}><CartesianGrid stroke="#223044" vertical={false} /><XAxis dataKey="cargo" stroke="#718096" fontSize={10} /><YAxis stroke="#718096" fontSize={11} /><Tooltip contentStyle={{ background: '#111c29', border: '1px solid #263548', borderRadius: 8, color: '#f4f7fb' }} /><Bar dataKey="tonnes" name="Tonnes" fill="#a987ff" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart text="Add real shipment records to see cargo patterns." />}</section>
      <section className="panel recommendations"><div className="panel-header"><div><h3>Recommended actions</h3><p>Based on current status fields</p></div></div>{recommendations.map((r, i) => <article className={`recommendation ${r.tone}`} key={r.title}><span>{r.tone === 'warning' ? '!' : r.tone === 'good' ? '✓' : '↗'}</span><div><strong>{r.title}</strong><p>{r.detail}</p></div></article>)}<p className="disclaimer">These are operational heuristics. They do not predict delivery times or replace carrier confirmation.</p></section></div>
    <button className="outline-btn" onClick={onOpenShipments}>Review shipment register</button></>;
}

export default function App() {
  const [user, setUser] = useState(null); const [page, setPage] = useState('overview');
  const [shipments, setShipments] = useState([]); const [loadingData, setLoadingData] = useState(false); const [dataError, setDataError] = useState('');
  useEffect(() => { try { const savedUser = localStorage.getItem('user'); const token = localStorage.getItem('token'); if (savedUser && token) setUser(JSON.parse(savedUser)); else { localStorage.removeItem('user'); localStorage.removeItem('token'); } } catch { localStorage.removeItem('user'); localStorage.removeItem('token'); } }, []);
  const refreshShipments = useCallback(async () => { if (!localStorage.getItem('token')) return; setLoadingData(true); setDataError(''); try { const response = await getShipments(); setShipments(Array.isArray(response.data) ? response.data : []); } catch (err) { setDataError(err.response?.status === 401 ? 'Session expired. Please log out and sign in again.' : (err.response?.data?.detail || 'Could not refresh shipment analytics. Check the backend connection.')); } finally { setLoadingData(false); } }, []);
  useEffect(() => { if (user) refreshShipments(); }, [user, refreshShipments]);
  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); setShipments([]); setPage('overview'); };
  if (!user) return <Auth onLoginSuccess={setUser} />;
  return <div className="app"><aside className="sidebar"><div className="brand"><div className="brand-icon">↗</div><div><h2>Freight-AI</h2><span>LOGISTICS INTELLIGENCE</span></div></div><nav aria-label="Main navigation">{navItems.map(item => <button key={item.id} type="button" className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/><div><strong>Demo workspace</strong><small>Connected session</small></div></div></aside>
    <main className="main"><header className="topbar"><div><p className="eyebrow">FREIGHT OPERATIONS</p><h1>{navItems.find(item => item.id === page)?.label || 'Overview'}</h1><p className="subtitle">Manage freight operations from one workspace.</p></div><div className="profile"><div className="avatar">{(user.name || 'U').slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{user.name}</strong><span>{user.companyName} · {user.role || 'shipper'}</span></div><button type="button" className="outline-btn logout-btn" onClick={handleLogout}>Log out</button></div></header>
    {dataError && <div className="alert error-alert" role="alert">{dataError}</div>}
    {page === 'overview' ? <Overview shipments={shipments} onOpenShipments={() => setPage('shipments')} onRefresh={refreshShipments} loading={loadingData} /> : page === 'shipments' ? <Shipments /> : page === 'marketplace' ? <Marketplace shipments={shipments} onOpenShipments={() => setPage('shipments')} /> : <Forecast shipments={shipments} onOpenShipments={() => setPage('shipments')} />}
    <footer className="app-footer">Freight-AI · Demo analytics use your saved shipment records. Rate estimates and operational insights are indicative only.</footer></main></div>;
}
