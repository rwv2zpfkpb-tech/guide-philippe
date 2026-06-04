// admin-panel.jsx — EditPanel (slide-over) + DeleteModal (exported to window)
const { useState, useEffect, useRef } = React;

/* ── Price selector ─────────────────────────────────── */
function PriceSelector({ value, onChange }) {
  return (
    <div className="price-sel">
      {[1, 2, 3, 4].map(n => (
        <button
          key={n} type="button"
          className={`price-btn${value === n ? ' sel' : ''}`}
          onClick={() => onChange(n)}
        >
          {'€'.repeat(n)}
        </button>
      ))}
    </div>
  );
}

/* ── Spoon picker ───────────────────────────────────── */
function SpoonPicker({ value, onChange }) {
  return (
    <div className="spoon-opts">
      {[4, 3, 2, 1].map(n => {
        const r = window.RATINGS[n];
        const burgActive = n === 1 && value === n;
        return (
          <div
            key={n}
            className={`spoon-opt${value === n ? ' sel' : ''}${burgActive ? ' spoon-burg' : ''}`}
            onClick={() => onChange(n)}
            role="radio"
            aria-checked={value === n}
          >
            <span className="spoon-opt-emoji">{r.emoji}</span>
            <div>
              <div className="spoon-opt-name">{r.label}</div>
              <div className="spoon-opt-sub">{r.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Image upload ───────────────────────────────────── */
function ImageUpload({ value, onChange }) {
  const [urlDraft, setUrlDraft] = useState(value || '');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { setUrlDraft(value || ''); }, [value]);

  function applyUrl() { onChange(urlDraft.trim()); }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const blobUrl = URL.createObjectURL(file);
      onChange(blobUrl);
      setUrlDraft(blobUrl);
    }
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      onChange(blobUrl);
      setUrlDraft(blobUrl);
    }
  }

  return (
    <div>
      <div className="img-thumb">
        {value
          ? <img src={value} alt="Preview" onError={() => onChange('')} />
          : <div className="img-thumb-empty">
              <IconImage size={22} />
              <span>no image</span>
            </div>
        }
      </div>

      <div
        className={`img-drop${dragOver ? ' over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current && fileRef.current.click()}
      >
        <div style={{color:'var(--c-n300)', display:'flex', justifyContent:'center'}}>
          <IconUpload />
        </div>
        <div className="img-drop-label">
          <strong>Drop an image here</strong> or click to browse
        </div>
        <div className="img-drop-sub">JPG, PNG, WebP — up to 8 MB</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{display:'none'}}
          onChange={handleFile}
        />
      </div>

      <div className="img-url-row">
        <input
          className="f-input"
          type="url"
          placeholder="…or paste an image URL"
          value={urlDraft}
          onChange={e => setUrlDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyUrl()}
          onClick={e => e.stopPropagation()}
        />
        <button className="btn-sm" type="button" onClick={applyUrl}>
          <IconCheck /> Apply
        </button>
      </div>
    </div>
  );
}

/* ── Edit / Create slide-over ───────────────────────── */
const BLANK = {
  name: '', cuisine: 'French', detail: '', price: 2,
  rating: 3, address: '', review: '', image: '', updated: '',
};

function EditPanel({ entry, isNew, onClose, onSave }) {
  const [form, setForm] = useState(BLANK);
  const isOpen = isNew || !!entry;

  useEffect(() => {
    if (isNew)       setForm({ ...BLANK });
    else if (entry)  setForm({ ...entry });
  }, [entry, isNew]);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function handleSave() {
    if (!form.name.trim()) return;
    const saved = { ...form, updated: 'Just now' };
    if (isNew) saved.id = Date.now();
    console.log('[Guide Karn Admin] save →', saved);
    onSave(saved);
  }

  return (
    <div className={`panel-overlay${isOpen ? ' open' : ''}`}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel-drawer" role="dialog" aria-modal="true"
           aria-label={isNew ? 'Add restaurant' : 'Edit restaurant'}>

        <div className="panel-hdr">
          <div className="panel-title">
            {isNew ? 'Add restaurant' : form.name || 'Edit entry'}
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        <div className="panel-body">

          {/* General Info */}
          <div className="f-section">
            <div className="f-section-hd">General Info</div>
            <div className="f-field">
              <label className="f-label">Restaurant name *</label>
              <input className="f-input" type="text" placeholder="e.g. Le Bernardin"
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="f-field">
              <label className="f-label">Short description</label>
              <input className="f-input" type="text" placeholder="e.g. Seafood · Fine Dining"
                value={form.detail} onChange={e => set('detail', e.target.value)} />
            </div>
            <div className="f-field">
              <label className="f-label">Google Maps address</label>
              <input className="f-input" type="text"
                placeholder="24 Rue Royale, Paris 8ème"
                value={form.address} onChange={e => set('address', e.target.value)} />
              <span className="f-hint warn">
                <IconInfo />
                Verify map coordinates manually if the address is changed.
              </span>
            </div>
          </div>

          {/* Categorization */}
          <div className="f-section">
            <div className="f-section-hd">Categorization</div>
            <div className="f-field">
              <label className="f-label">Cuisine type</label>
              <select className="f-select" value={form.cuisine}
                onChange={e => set('cuisine', e.target.value)}>
                {window.CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="f-field">
              <label className="f-label">Price level</label>
              <PriceSelector value={form.price} onChange={v => set('price', v)} />
            </div>
            <div className="f-field">
              <label className="f-label" style={{marginBottom:8}}>Official Spoon Rating</label>
              <SpoonPicker value={form.rating} onChange={v => set('rating', v)} />
            </div>
          </div>

          {/* Editorial */}
          <div className="f-section">
            <div className="f-section-hd">Editorial Content</div>
            <div className="f-field">
              <label className="f-label">Official editor review</label>
              <textarea
                className="f-textarea"
                placeholder="Extracted from editorial notes or Google Maps lists. Aim for 2–4 polished paragraphs."
                value={form.review}
                onChange={e => set('review', e.target.value)}
                style={{minHeight: 160}}
              />
              <div className="f-charcount">{form.review.length} characters</div>
            </div>
          </div>

          {/* Image */}
          <div className="f-section">
            <div className="f-section-hd">Image</div>
            <ImageUpload value={form.image} onChange={v => set('image', v)} />
          </div>

        </div>

        <div className="panel-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>
            {isNew ? 'Add restaurant' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete confirmation modal ──────────────────────── */
function DeleteModal({ entry, onClose, onConfirm }) {
  const isOpen = !!entry;
  return (
    <div className={`del-overlay${isOpen ? ' open' : ''}`}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="del-modal">
        {entry && (
          <>
            <div className="del-icon"><IconAlert /></div>
            <div className="del-title">Delete "{entry.name}"?</div>
            <div className="del-sub">
              This permanently removes the entry, its editorial review, and all
              associated metadata. This action cannot be undone.
            </div>
            <div className="del-actions">
              <button className="btn-keep" onClick={onClose}>Keep it</button>
              <button className="btn-delete" onClick={() => { onConfirm(); onClose(); }}>
                Yes, delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { EditPanel, DeleteModal });
