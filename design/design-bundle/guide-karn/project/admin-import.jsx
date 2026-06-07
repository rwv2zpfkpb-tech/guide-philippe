// admin-import.jsx — Google Maps data source management
const { useState, useRef } = React;

const FREQ_OPTIONS = [
  { value: 'manual', label: 'Manual only' },
  { value: 'hourly', label: 'Every hour'  },
  { value: 'daily',  label: 'Daily'       },
  { value: 'weekly', label: 'Weekly'      },
];

function StatusBadge({ status }) {
  const map = {
    synced:  { cls: 'synced',  label: 'Synced'       },
    syncing: { cls: 'syncing', label: 'Syncing\u2026' },
    error:   { cls: 'error',   label: 'Error'        },
    pending: { cls: 'pending', label: 'Never synced' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`status-badge ${s.cls}`}>
      <span className={`status-dot${status === 'syncing' ? ' pulse' : ''}`}></span>
      {s.label}
    </span>
  );
}

function SourceCard({ source, onUpdate, onDelete, onSync }) {
  const isSyncing = source.status === 'syncing';
  const isError   = source.status === 'error';

  return (
    <div className={`source-card${isError ? ' source-error' : ''}`}>
      <div className="source-card-top">
        <div className="source-card-info">
          <div className="source-name">{source.name}</div>
          <div className="source-url">{source.url}</div>
        </div>
        <div className="source-card-actions">
          <button
            className="btn-sync"
            disabled={isSyncing}
            onClick={() => onSync(source.id)}
          >
            <span className={isSyncing ? 'spin' : ''} style={{display:'inline-flex'}}>
              <IconRefresh size={13} />
            </span>
            {isError ? 'Retry' : 'Sync now'}
          </button>
          <button
            className="btn-act danger"
            style={{padding:'6px 10px'}}
            onClick={() => onDelete(source.id)}
          >
            <IconTrash size={12} />
          </button>
        </div>
      </div>

      <div className="source-card-meta">
        <StatusBadge status={source.status} />
        {source.newCount > 0 && (
          <span className="source-new-badge">+{source.newCount} new</span>
        )}
        {source.entryCount > 0 && (
          <span className="source-meta-text">{source.entryCount} entries</span>
        )}
        <span className="source-meta-sep">&middot;</span>
        <span className="source-meta-text">
          Last sync: {source.lastSync || 'Never'}
        </span>
        <span style={{flex:1}}></span>
        <span className="source-meta-text">Frequency:</span>
        <select
          className="freq-select"
          value={source.freq}
          onChange={e => onUpdate(source.id, { freq: e.target.value })}
        >
          {FREQ_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isError && (
        <div className="source-error-msg">
          <IconAlert size={13} />
          Connection failed \u2014 verify the list is set to Public in Google Maps.
        </div>
      )}
    </div>
  );
}

function AddSourceForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url,  setUrl]  = useState('');
  const [freq, setFreq] = useState('daily');

  function submit() {
    if (!name.trim() || !url.trim()) return;
    onAdd({ name: name.trim(), url: url.trim(), freq });
    setName(''); setUrl(''); setFreq('daily'); setOpen(false);
  }

  if (!open) return (
    <button className="btn-add-source" onClick={() => setOpen(true)}>
      <IconPlus size={15} /> Add source list
    </button>
  );

  return (
    <div className="add-source-form">
      <div className="f-section-hd" style={{marginBottom:18}}>New source</div>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,2fr)', gap:12, marginBottom:14}}>
        <div className="f-field" style={{marginBottom:0}}>
          <label className="f-label">List name</label>
          <input className="f-input" placeholder="e.g. Paris Fine Dining"
            value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="f-field" style={{marginBottom:0}}>
          <label className="f-label">Google Maps list URL</label>
          <input className="f-input" type="url" placeholder="https://maps.app.goo.gl/\u2026"
            value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
      </div>
      <div style={{display:'flex', alignItems:'flex-end', gap:10, flexWrap:'wrap'}}>
        <div className="f-field" style={{marginBottom:0, flex:'0 0 180px'}}>
          <label className="f-label">Pull frequency</label>
          <select className="f-select" value={freq} onChange={e => setFreq(e.target.value)}>
            {FREQ_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-save" onClick={submit}>Add source</button>
        <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function ImportView() {
  const [sources,    setSources]    = useState(window.IMPORT_SOURCES);
  const [globalFreq, setGlobalFreq] = useState('daily');
  const [conflict,   setConflict]   = useState('keep');
  const timers = useRef({});

  function updateSource(id, patch) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function handleSync(id) {
    updateSource(id, { status: 'syncing' });
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      updateSource(id, {
        status:     'synced',
        lastSync:   new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) + ' today',
        newCount:   Math.floor(Math.random() * 6),
        entryCount: Math.floor(30 + Math.random() * 30),
      });
    }, 1800 + Math.random() * 1000);
  }

  function handleSyncAll() {
    sources.forEach(s => handleSync(s.id));
  }

  function handleDelete(id) {
    setSources(prev => prev.filter(s => s.id !== id));
  }

  function handleAdd(src) {
    setSources(prev => [
      ...prev,
      { id: Date.now(), ...src, status: 'pending', lastSync: null, entryCount: 0, newCount: 0 },
    ]);
  }

  const syncing = sources.filter(s => s.status === 'syncing').length;

  return (
    <main className="adm-main">
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                   marginBottom:6, gap:16, flexWrap:'wrap'}}>
        <div>
          <h1 className="adm-page-title">Data Sources</h1>
          <p className="adm-page-sub">
            {sources.length} lists connected &middot; Entries matched by name and de-duplicated on import.
          </p>
        </div>
        <button className="btn-primary" onClick={handleSyncAll} disabled={syncing > 0}
          style={{marginTop:8, flexShrink:0}}>
          <span className={syncing > 0 ? 'spin' : ''} style={{display:'inline-flex'}}>
            <IconRefresh size={14} />
          </span>
          {syncing > 0
            ? `Syncing ${syncing} source${syncing > 1 ? 's' : ''}\u2026`
            : 'Sync all sources'}
        </button>
      </div>

      <div className="source-list">
        {sources.map(s => (
          <SourceCard
            key={s.id} source={s}
            onUpdate={updateSource}
            onDelete={handleDelete}
            onSync={handleSync}
          />
        ))}
        <AddSourceForm onAdd={handleAdd} />
      </div>

      <div className="import-settings-block">
        <div className="f-section-hd" style={{marginBottom:22}}>Global Settings</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:24}}>

          <div className="f-field" style={{marginBottom:0}}>
            <label className="f-label">Default pull frequency</label>
            <select className="f-select" value={globalFreq}
              onChange={e => setGlobalFreq(e.target.value)}>
              {FREQ_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="f-hint">Applied to newly added sources.</span>
          </div>

          <div className="f-field" style={{marginBottom:0}}>
            <label className="f-label">Conflict resolution</label>
            <div className="radio-group">
              {[
                { v:'keep',      name:'Keep existing',         desc:'Manual edits are never overwritten'       },
                { v:'overwrite', name:'Overwrite from source', desc:'Always use latest Google Maps data'       },
              ].map(o => (
                <label key={o.v}
                  className={`radio-opt${conflict === o.v ? ' sel' : ''}`}
                  onClick={() => setConflict(o.v)}>
                  <span className="radio-dot"></span>
                  <div>
                    <div style={{fontWeight:500, fontSize:'.875rem'}}>{o.name}</div>
                    <div style={{fontSize:'.75rem', color:'var(--c-n400)', marginTop:2}}>{o.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="f-field" style={{marginBottom:0}}>
            <label className="f-label">Timezone</label>
            <select className="f-select">
              <option>Europe/Paris (UTC+2)</option>
              <option>Europe/London (UTC+1)</option>
              <option>UTC</option>
            </select>
            <span className="f-hint">Used for scheduled pull times.</span>
          </div>

        </div>
      </div>
    </main>
  );
}

Object.assign(window, { ImportView });
