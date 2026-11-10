import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { TABLES } from '../lib/tables';
import { money, dateFr, STATUTS } from '../lib/format';

function Cell({ type, value }) {
  if (type === 'money') return money(value);
  if (type === 'date') return dateFr(value);
  if (type === 'statut') {
    const s = STATUTS[value] || { label: value || '—', tone: 'neutral' };
    return <span className={'badge ' + s.tone}>{s.label}</span>;
  }
  return value || '—';
}

export default function TableView({ table, rows, settings, readOnly, onAdd, onEdit, onDelete }) {
  const cfg = TABLES[table];
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState('');
  const statuts = cfg.fields.find(f => f[0] === 'statut')?.[3];

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(r => !statut || r.statut === statut)
      .filter(r => !q || [r.nom, r.prenom, r.demarcheur, r.telephone, r.notes].some(v => String(v || '').toLowerCase().includes(q)))
      .map(r => ({ ...r, ...cfg.compute(r, settings) }))
      .sort((a, b) => String(b[cfg.dateField] || '').localeCompare(String(a[cfg.dateField] || '')));
  }, [rows, query, statut, settings, cfg]);

  const actions = row => readOnly ? null : (
    <div className="row-actions">
      <button className="icon-btn" onClick={() => onEdit(row)} aria-label={`Modifier ${cfg.title(row)}`}><Pencil size={16} /></button>
      <button className="icon-btn danger" onClick={() => onDelete(row)} aria-label={`Supprimer ${cfg.title(row)}`}><Trash2 size={16} /></button>
    </div>
  );
  const original = row => rows.find(r => r.id === row.id) || row;

  return (
    <section className="panel table-panel">
      <div className="panel-head">
        <div><span className="eyebrow">Registre</span><h2>{cfg.label} <span className="count">{view.length}</span></h2></div>
        {readOnly ? <span className="badge neutral">Lecture seule</span> : <button className="btn primary" onClick={onAdd}><Plus size={17} /> Ajouter</button>}
      </div>

      {rows.length > 0 && (
        <div className="toolbar">
          <label className="search"><Search size={16} aria-hidden="true" />
            <input type="search" placeholder="Rechercher…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Rechercher" />
          </label>
          {statuts && (
            <div className="chips" role="group" aria-label="Filtrer par statut">
              {['', ...statuts].map(s => (
                <button key={s} className={statut === s ? 'chip active' : 'chip'} onClick={() => setStatut(s)}>{s ? STATUTS[s].label : 'Tous'}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {!rows.length ? <div className="empty">Aucune donnée pour l’instant.{!readOnly && <><br />Ajoutez votre premier élément.</>}</div>
        : !view.length ? <div className="empty">Aucun résultat pour ce filtre.</div>
        : <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nom</th>{cfg.columns.map(c => <th key={c[0]} className={c[2] === 'money' ? 'num' : ''}>{c[1]}</th>)}<th></th></tr></thead>
              <tbody>
                {view.map(row => (
                  <tr key={row.id}>
                    <td className="name">{cfg.title(row)}{row.demarcheur && <small>via {row.demarcheur}</small>}</td>
                    {cfg.columns.map(c => <td key={c[0]} className={c[2] === 'money' ? 'num' : ''}><Cell type={c[2]} value={row[c[0]]} /></td>)}
                    <td>{actions(original(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="record-list">
            {view.map(row => (
              <li className="record" key={row.id}>
                <header>
                  <div><b>{cfg.title(row)}</b><small>{dateFr(row[cfg.dateField])}{row.demarcheur ? ` · via ${row.demarcheur}` : ''}</small></div>
                  {row.statut && <Cell type="statut" value={row.statut} />}
                </header>
                <dl>
                  {cfg.columns.filter(c => !['date', 'statut'].includes(c[2])).map(c => (
                    <div key={c[0]}><dt>{c[1]}</dt><dd><Cell type={c[2]} value={row[c[0]]} /></dd></div>
                  ))}
                </dl>
                {row.notes && <p className="record-notes">{row.notes}</p>}
                {actions(original(row))}
              </li>
            ))}
          </ul>
        </>}
    </section>
  );
}
