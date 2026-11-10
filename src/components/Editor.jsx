import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { STATUTS } from '../lib/format';

export function Sheet({ title, eyebrow, onClose, children, as: Tag = 'div', ...rest }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Tag className="modal" role="dialog" aria-modal="true" aria-label={title} {...rest}>
        <div className="panel-head">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        {children}
      </Tag>
    </div>
  );
}

export default function Editor({ config, row, onClose, onSave }) {
  const [form, setForm] = useState(row || {});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Sheet as="form" eyebrow={config.label} title={row ? 'Modifier' : 'Nouvel élément'} onClose={onClose} onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div className="form-grid">
        {config.fields.map(([k, label, type, opts], i) => (
          <label key={k} className={k === 'notes' ? 'full' : ''}>{label}
            {type === 'select'
              ? <select value={form[k] || opts[0]} onChange={e => set(k, e.target.value)}>{opts.map(o => <option key={o} value={o}>{STATUTS[o]?.label || o}</option>)}</select>
              : k === 'notes'
                ? <textarea rows={3} value={form[k] ?? ''} onChange={e => set(k, e.target.value)} />
                : <input
                    type={type || 'text'} value={form[k] ?? ''} onChange={e => set(k, e.target.value)}
                    required={k === 'nom'} autoFocus={i === 0 && !row}
                    {...(type === 'number' ? { step: '0.01', min: '0', inputMode: 'decimal', placeholder: '0,00' } : {})}
                  />}
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Annuler</button>
        <button className="btn primary">Enregistrer</button>
      </div>
    </Sheet>
  );
}
