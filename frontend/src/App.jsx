import { useEffect, useState } from 'react';
import { request } from './api';

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
const date = value => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function App() {
  const [page, setPage] = useState('Overview');
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({});
  const [version, setVersion] = useState('local');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    try {
      const [p, m, d, v] = await Promise.all([request('/products'), request('/movements'), request('/dashboard'), request('/version')]);
      setProducts(p); setMovements(m); setSummary(d); setVersion(v.commit); setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const visible = products.filter(p => (!lowOnly || p.quantity <= p.reorder_level) && `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter(p => p.quantity <= p.reorder_level);
  const open = data => { setFormError(''); setModal(data); };

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setFormError('');
    try {
      if (modal.type === 'stock') {
        const units = Number(data.units);
        await request(`/products/${modal.product.id}/movements`, { method: 'POST', body: JSON.stringify({ delta: data.kind === 'ISSUE' ? -Math.abs(units) : data.kind === 'RECEIPT' ? Math.abs(units) : units, kind: data.kind, reason: data.reason }) });
      } else {
        await request(modal.product ? `/products/${modal.product.id}` : '/products', { method: modal.product ? 'PUT' : 'POST', body: JSON.stringify({ ...data, reorder_level: Number(data.reorder_level) }) });
      }
      setModal(null); await load();
    } catch (e) { setFormError(e.message); }
    finally { setBusy(false); }
  }

  async function archive(product) {
    if (busy || !window.confirm(`Archive ${product.name}? Its stock history will be kept.`)) return;
    setBusy(true);
    try { await request(`/products/${product.id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <div className="shell">
    <aside className="sidebar">
      <a href="#" className="brand" onClick={e => { e.preventDefault(); setPage('Overview'); }}><span className="brand-symbol">▦</span><span>stock<span className="brand-light">pilot</span><small>INVENTORY, IN VIEW.</small></span></a>
      <div className="workspace"><span className="workspace-icon">S</span><div><strong>Demo warehouse</strong><small>Capstone workspace</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{[['Overview', '◫'], ['Products', '▦'], ['Stock history', '⇄']].map(([name, icon]) => <button key={name} className={page === name ? 'active' : ''} onClick={() => { setPage(name); setSearch(''); setLowOnly(false); }}><span>{icon}</span>{name}{name === 'Products' && <small>{products.length}</small>}</button>)}</nav>
      <div className="sidebar-note"><span className="live-dot"/> A clear view of every unit.<p>Record stock changes.<br/>Keep the full story.</p></div>
      <footer><div className="avatar">SP</div><div><strong>StockPilot</strong><small>DevOps capstone · v1.0</small></div></footer>
    </aside>
    <main>
      <div className="topbar"><span>Workspace <span className="slash">/</span> <strong>{page}</strong></span><span className="version" title={version}>COMMIT <code>{version.slice(0, 8)}</code></span></div>
      <header className="page-header"><div><div className="eyebrow">YOUR WAREHOUSE AT A GLANCE</div><h1>{page === 'Overview' ? 'Everything accounted for.' : page === 'Products' ? 'Your product catalog.' : 'Every movement, recorded.'}</h1><p>{page === 'Stock history' ? 'A permanent record of stock received, issued, and adjusted.' : 'Know what’s in stock, what’s moving, and what needs attention.'}</p></div><button className="primary" disabled={busy} onClick={() => open({ type: 'product' })}>＋ Add product</button></header>
      {error && <div className="alert" role="alert">{error} <button onClick={load}>Retry</button></div>}
      {loading ? <div className="empty">Connecting to your inventory…</div> : <>
        {page === 'Overview' && <>
          <section className="kpis"><Kpi icon="▦" label="Active products" value={summary.product_count || 0} note="Across your catalog"/><Kpi icon="◈" label="Inventory value" value={money(summary.inventory_value)} note="Current stock · INR"/><Kpi icon="▤" label="Units on hand" value={summary.total_units || 0} note="Ready in the warehouse"/><Kpi icon="!" label="Needs attention" value={summary.low_stock_count || 0} note="At or below reorder level" warning/></section>
          <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h2>Stock watch</h2><p>Keep your next reorder one step ahead.</p></div><span className="count-pill">{lowStock.length} items</span></div>{lowStock.length ? lowStock.map(p => <div className="watch-row" key={p.id}><div className="product-icon">{p.category.slice(0, 1)}</div><div className="watch-name"><strong>{p.name}</strong><small>{p.sku} · {p.category}</small></div><div className="watch-level"><strong>{p.quantity} <small>units</small></strong><small>Reorder at {p.reorder_level}</small></div><button className="subtle" onClick={() => open({ type: 'stock', product: p })}>Restock ↗</button></div>) : <div className="empty">No products need restocking.</div>}</section><section className="panel activity"><div className="panel-heading"><div><h2>Latest movements</h2><p>Your inventory’s recent story.</p></div></div>{movements.slice(0, 5).map(m => <div className="movement-card" key={m.id}><span className={`movement-sign ${m.delta > 0 ? 'positive' : 'negative'}`}>{m.delta > 0 ? '↙' : '↗'}</span><div><strong>{m.product_name}</strong><small>{m.reason}</small><time>{date(m.created_at)}</time></div><b className={m.delta > 0 ? 'positive-text' : 'negative-text'}>{m.delta > 0 ? '+' : ''}{m.delta}</b></div>)}{!movements.length && <div className="empty">Your first stock movement will appear here.</div>}<button className="view-all" onClick={() => setPage('Stock history')}>View stock history →</button></section></div>
        </>}
        {page !== 'Stock history' && <section className="panel catalog"><div className="panel-heading"><div><h2>Product inventory</h2><p>{visible.length} products · quantities backed by your stock ledger</p></div><div className="table-controls"><input aria-label="Search products" placeholder="Search name, SKU, category…" value={search} onChange={e => setSearch(e.target.value)}/><button className={`filter-button ${lowOnly ? 'selected' : ''}`} onClick={() => setLowOnly(!lowOnly)}>Low stock {lowOnly ? '✓' : ''}</button></div></div><div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Unit price</th><th>On hand</th><th>Stock status</th><th>Actions</th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td><div className="product-cell"><span className="product-icon">{p.category.slice(0, 1)}</span><div><strong>{p.name}</strong><small>{p.sku}</small></div></div></td><td>{p.category}</td><td>{money(p.unit_price)}</td><td className="quantity">{p.quantity}</td><td><span className={`badge ${p.quantity <= p.reorder_level ? 'low' : 'good'}`}>{p.quantity === 0 ? 'Out of stock' : p.quantity <= p.reorder_level ? 'Low stock' : 'In stock'}</span></td><td><div className="actions"><button disabled={busy} onClick={() => open({ type: 'stock', product: p })}>Stock ⇄</button><button disabled={busy} onClick={() => open({ type: 'product', product: p })}>Edit</button><button className="archive" disabled={busy} onClick={() => archive(p)}>Archive</button></div></td></tr>)}</tbody></table></div>{!visible.length && <div className="empty">{products.length ? 'No products match your filters.' : 'Your catalog is ready for its first product.'}</div>}</section>}
        {page === 'Stock history' && <section className="panel"><div className="panel-heading"><div><h2>Movement ledger</h2><p>Archived products retain their history. Entries cannot be edited.</p></div></div><div className="table-scroll"><table><thead><tr><th>Product</th><th>Movement</th><th>Units</th><th>Reason</th><th>Recorded</th></tr></thead><tbody>{movements.map(m => <tr key={m.id}><td><strong>{m.product_name}</strong><small className="block">{m.sku}</small></td><td><span className="badge neutral">{m.kind}</span></td><td className={m.delta > 0 ? 'positive-text' : 'negative-text'}>{m.delta > 0 ? '+' : ''}{m.delta}</td><td>{m.reason}</td><td>{date(m.created_at)}</td></tr>)}</tbody></table></div>{!movements.length && <div className="empty">No stock movements yet. Receive stock from the product catalog.</div>}</section>}
      </>}
      <div className="page-footer"><span>StockPilot · Inventory with a paper trail.</span><span>React / FastAPI / PostgreSQL</span></div>
    </main>
    {modal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div className="eyebrow">{modal.type === 'stock' ? modal.product.sku : 'PRODUCT CATALOG'}</div><button aria-label="Close dialog" disabled={busy} onClick={() => setModal(null)}>×</button></div><h2 id="modal-title">{modal.type === 'stock' ? `Move stock · ${modal.product.name}` : modal.product ? 'Edit product' : 'Add a product'}</h2><p>{modal.type === 'stock' ? `${modal.product.quantity} units on hand. Every change creates a ledger entry.` : 'New products begin at zero stock. Receive stock after creating one.'}</p><form onSubmit={submit}>
      {modal.type === 'stock' ? <><label>Movement type<select name="kind" defaultValue="RECEIPT"><option value="RECEIPT">Receive stock</option><option value="ISSUE">Issue stock</option><option value="ADJUSTMENT">Stock adjustment</option></select></label><label>Units<input aria-label="Units" name="units" type="number" step="1" required defaultValue="1"/><small>Use positive units for receipt/issue; signed units for adjustments.</small></label><label>Reason<input name="reason" maxLength="240" required placeholder="e.g. Received delivery"/></label></> : <><div className="form-grid"><label>SKU<input name="sku" defaultValue={modal.product?.sku || ''} pattern="[A-Za-z0-9_-]+" maxLength="40" required placeholder="ELEC-103"/></label><label>Category<input name="category" defaultValue={modal.product?.category || ''} maxLength="80" required placeholder="Electronics"/></label></div><label>Product name<input name="name" defaultValue={modal.product?.name || ''} maxLength="120" required placeholder="e.g. Mechanical keyboard"/></label><div className="form-grid"><label>Unit price (INR)<input name="unit_price" type="number" min="0" step="0.01" required defaultValue={modal.product?.unit_price || '0.00'}/></label><label>Reorder level<input name="reorder_level" type="number" min="0" step="1" required defaultValue={modal.product?.reorder_level ?? 5}/></label></div></>}
      {formError && <div className="alert" role="alert">{formError}</div>}<button className="primary full" disabled={busy}>{busy ? 'Saving…' : modal.type === 'stock' ? 'Record movement' : 'Save product'}</button>
    </form></section></div>}
  </div>;
}

function Kpi({ icon, label, value, note, warning }) {
  return <div className={`kpi ${warning ? 'warning' : ''}`}><div className="kpi-top"><span>{label}</span><span className="kpi-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></div>;
}
