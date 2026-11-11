import React, { useEffect, useRef, useState } from 'react';
import { money } from '../lib/format';
import { axisTicks } from '../lib/stats';

const moisFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });
const moisLong = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const asDate = m => new Date(`${m}-01T00:00:00`);
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

/** Largeur réelle du conteneur : le graphique est dessiné à l'échelle 1, le texte garde sa taille. */
function useWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Colonnes : gain net par mois de dépôt. Une seule série, donc pas de légende. */
export function GainsChart({ data }) {
  const [active, setActive] = useState(null);
  const [ref, W] = useWidth();
  const { mois, sansDate } = data;
  if (!mois.length) return <div className="empty small">Aucun dossier tranché (visa ou refus) avec une date de dépôt.</div>;

  const H = W < 420 ? 200 : 240, pad = { l: 44, r: 6, t: 20, b: 26 };
  const every = Math.ceil(mois.length / Math.max(2, Math.floor((W - pad.l) / 58))); // une étiquette de mois tous les `every`
  const ticks = axisTicks(Math.min(...mois.map(m => m.gain)), Math.max(...mois.map(m => m.gain)));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = v => pad.t + (hi - v) / (hi - lo) * (H - pad.t - pad.b);
  const band = (W - pad.l - pad.r) / mois.length;
  const bw = Math.min(24, band * 0.6);
  const best = mois.reduce((a, b) => (b.gain > a.gain ? b : a));
  const bar = (m, i) => {
    const x = pad.l + band * i + (band - bw) / 2, y0 = y(0), y1 = y(m.gain), r = Math.min(4, Math.abs(y1 - y0));
    // Extrémité arrondie côté valeur, carrée sur la ligne de base.
    return m.gain >= 0
      ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z`
      : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 - r} V${y0} Z`;
  };
  const tip = active !== null ? mois[active] : null;

  return (
    <figure className="viz">
      <div className="viz-plot" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Gain net par mois de dépôt, ${mois.length} mois`}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-base' : 'viz-grid'} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="viz-tick">{compact.format(t)} €</text>
            </g>
          ))}
          {mois.map((m, i) => (
            <g key={m.mois}>
              <path d={bar(m, i)} className={active === null || active === i ? 'viz-bar' : 'viz-bar dim'} />
              {m === best && active === null && <text x={pad.l + band * i + band / 2} y={y(m.gain) - 6} textAnchor="middle" className="viz-value">{money(m.gain)}</text>}
              {(mois.length - 1 - i) % every === 0 && <text x={pad.l + band * i + band / 2} y={H - 8} textAnchor="middle" className="viz-tick">{moisFmt.format(asDate(m.mois))}</text>}
              <rect
                x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t - pad.b} fill="transparent" tabIndex={0}
                aria-label={`${moisLong.format(asDate(m.mois))} : ${money(m.gain)}, ${m.visas} visa(s), ${m.refus} refus`}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(i)}
              />
            </g>
          ))}
        </svg>
        {tip && (
          <div className="viz-tip" style={active < mois.length / 2 ? { left: pad.l + band * (active + 1) + 4 } : { right: W - (pad.l + band * active) + 4 }}>
            <b>{moisLong.format(asDate(tip.mois))}</b>
            <span>{money(tip.gain)}</span>
            <small>{tip.visas} visa{tip.visas > 1 ? 's' : ''} · {tip.refus} refus</small>
          </div>
        )}
      </div>
      <details className="viz-table">
        <summary>Voir les chiffres</summary>
        <table>
          <thead><tr><th>Mois de dépôt</th><th className="num">Visas</th><th className="num">Refus</th><th className="num">Gain net</th></tr></thead>
          <tbody>{mois.slice().reverse().map(m => <tr key={m.mois}><td>{moisLong.format(asDate(m.mois))}</td><td className="num">{m.visas}</td><td className="num">{m.refus}</td><td className="num">{money(m.gain)}</td></tr>)}</tbody>
        </table>
      </details>
      {sansDate > 0 && <figcaption className="footnote">{sansDate} dossier{sansDate > 1 ? 's' : ''} sans date de dépôt non représenté{sansDate > 1 ? 's' : ''}.</figcaption>}
    </figure>
  );
}

/** Barre segmentée : répartition des dossiers par statut, avec légende chiffrée. */
export function StatutBar({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return null;
  return (
    <div className="viz">
      <div className="seg" role="img" aria-label={'Répartition des dossiers : ' + parts.map(p => `${p.label} ${p.value}`).join(', ')}>
        {parts.filter(p => p.value > 0).map(p => (
          <span key={p.label} className={'seg-part s' + p.slot} style={{ flexGrow: p.value }} title={`${p.label} : ${p.value} (${Math.round(p.value / total * 100)} %)`} />
        ))}
      </div>
      <ul className="legend">
        {parts.map(p => (
          <li key={p.label}><i className={'swatch s' + p.slot} aria-hidden="true" />{p.label}<b>{p.value}</b><small>{Math.round(p.value / total * 100)} %</small></li>
        ))}
      </ul>
    </div>
  );
}
