// admin-app.jsx — AdminApp root component
const { useState, useRef } = React;

function AdminApp() {
  const [restaurants, setRestaurants] = useState(window.INITIAL_RESTAURANTS);
  const [query,       setQuery]       = useState('');
  const [editEntry,   setEditEntry]   = useState(null);
  const [isNew,       setIsNew]       = useState(false);
  const [delEntry,    setDelEntry]    = useState(null);
  const [toast,       setToast]       = useState(false);
  const [tab,         setTab]         = useState('restaurants');
  const toastTimer = useRef(null);

  /* Filtered list */
  const q = query.toLowerCase();
  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.cuisine.toLowerCase().includes(q) ||
    r.detail.toLowerCase().includes(q) ||
    r.address.toLowerCase().includes(q)
  );

  /* Toast helper */
  function fireToast() {
    setToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 2600);
  }

  /* Edit */
  function handleEdit(r) {
    setIsNew(false);
    setEditEntry(r);
  }

  /* New */
  function handleNew() {
    setIsNew(true);
    setEditEntry({});
  }

  /* Close panel */
  function handleClose() {
    setEditEntry(null);
    setIsNew(false);
  }

  /* Save */
  function handleSave(saved) {
    if (isNew) {
      setRestaurants(prev => [saved, ...prev]);
    } else {
      setRestaurants(prev => prev.map(r => r.id === saved.id ? saved : r));
    }
    handleClose();
    fireToast();
  }

  /* Delete */
  function handleDelete() {
    setRestaurants(prev => prev.filter(r => r.id !== delEntry.id));
    fireToast();
  }

  return (
    <div className="adm-shell">

      {/* ── Header ── */}
      <header className="adm-hdr">
        <div className="adm-hdr-inner">
          <span className="adm-logo">Guide <span style={{color:'var(--c-burg)'}}>Philippe</span></span>
          <span className="adm-chip">Admin</span>
          <div className="adm-hdr-divider"></div>
          <a className="adm-nav-link" href="Guide Karn Homepage.html" style={{textDecoration:'none'}}>← Public site</a>
          <div className="adm-hdr-right">
            <span className="adm-hdr-name">Isabelle Farron</span>
            <div className="adm-avatar">IF</div>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="adm-tabs">
        <div className="adm-tabs-inner">
          <button className={`adm-tab${tab === 'restaurants' ? ' active' : ''}`}
            onClick={() => setTab('restaurants')}>
            Restaurants
            <span className="adm-tab-count">{restaurants.length}</span>
          </button>
          <button className={`adm-tab${tab === 'import' ? ' active' : ''}`}
            onClick={() => setTab('import')}>
            Data Sources
            <span className="adm-tab-count">{window.IMPORT_SOURCES.length}</span>
          </button>
        </div>
      </div>

      {tab === 'import' ? <ImportView /> : (
        <main className="adm-main">
          <h1 className="adm-page-title">Restaurants</h1>
          <p className="adm-page-sub">
            {restaurants.length} entries · Paris edition
          </p>

          <StatsBar restaurants={restaurants} />

          <div className="adm-toolbar">
            <div className="adm-search">
              <IconSearch size={14} />
              <input
                type="text"
                placeholder="Search by name, cuisine, address…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div style={{flex:1}}></div>
            <button className="btn-primary" onClick={handleNew}>
              <IconPlus /> Add new
            </button>
          </div>

          <RestaurantTable
            restaurants={filtered}
            onEdit={handleEdit}
            onDelete={r => setDelEntry(r)}
          />
        </main>
      )}

      {/* ── Edit / Create panel ── */}
      <EditPanel
        entry={editEntry}
        isNew={isNew}
        onClose={handleClose}
        onSave={handleSave}
      />

      {/* ── Delete modal ── */}
      <DeleteModal
        entry={delEntry}
        onClose={() => setDelEntry(null)}
        onConfirm={handleDelete}
      />

      {/* ── Toast ── */}
      <div className={`toast${toast ? ' show' : ''}`}>
        <IconCheck size={12} />
        Changes saved successfully
      </div>

    </div>
  );
}

const rootEl = document.getElementById('root');
ReactDOM.createRoot(rootEl).render(<AdminApp />);
