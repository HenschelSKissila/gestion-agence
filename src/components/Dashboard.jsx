import React from 'react';
import { money, pct } from '../lib/format';

const BANKS = [['n26', 'N26'], ['sparkasse', 'Sparkasse Bremen'], ['commerzbank', 'Commerzbank'], ['wise', 'Wise']];

/** Relevé « + / − / = » : rend la formule lisible ligne par ligne. Affichage seul. */
function Statement({ lines, total }) {
  return (
    <dl className="statement">
      {lines.map(([sign, label, value]) => (
        <div className="statement-line" key={label}>
          <dt><span className={sign === '+' ? 'sign plus' : 'sign minus'}>{sign}</span>{label}</dt>
          <dd>{money(value)}</dd>
        </div>
      ))}
      <div className="statement-line total">
        <dt><span className="sign">=</span>{total[0]}</dt>
        <dd>{money(total[1])}</dd>
      </div>
    </dl>
  );
}

export default function Dashboard({ totals: t }) {
  const c = t.controle;
  const ds = t.associesCalcules;
  const kState = c.resultat > 0 ? ['pos', 'Excédent'] : c.resultat < 0 ? ['neg', 'Déficit'] : ['neutral', 'Équilibre'];
  const sState = t.solvabilite >= 0 ? ['pos', 'Cohérent'] : ['neg', 'Insuffisant'];
  const kpis = [
    ['Capital global', t.capital, 'info', 'Banques + comptes bloqués + prêts − dettes'],
    ['Disponible', t.disponible, 'warn', 'Total des 4 banques'],
    ['Gain net agence', t.gainNet, 'pos', 'Visas et refus'],
    ['Reste à rembourser', t.resteRemb, 'neg', 'Clients refusés'],
    ['On me doit', t.perso, 'info', 'Prêts personnels'],
    ['Dettes', t.dettes, 'neg', 'Ce que je dois']
  ];

  return (
    <>
      <section className="kpis" aria-label="Indicateurs clés">
        {kpis.map(([label, value, tone, hint]) => (
          <article className={'kpi ' + tone} key={label}>
            <span className="kpi-label">{label}</span>
            <strong>{money(value)}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">Trésorerie</span><h2>Soldes bancaires</h2></div>
            <b className="figure">{money(t.banques)}</b>
          </div>
          <div className="bank-grid">
            {BANKS.map(([k, label]) => (
              <div className="tile" key={k}><span>{label}</span><strong>{money(t.banqueDetails[k])}</strong></div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">Suivi des dossiers</span><h2>Activité</h2></div>
          </div>
          <div className="stat-grid">
            {[[t.nbCours, 'En cours'], [t.nbVisa, 'Visas'], [t.nbRefus, 'Refus'], [t.nbCandidats, 'Candidats']].map(([n, label]) => (
              <div className="tile center" key={label}><strong>{n}</strong><span>{label}</span></div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">Contrôle de compte</span><h2>Solde de contrôle</h2></div>
            <span className={'badge ' + kState[0]}>{kState[1]}</span>
          </div>
          <Statement
            lines={[
              ['+', 'Banques', c.termes.banques],
              ['+', 'Comptes bloqués', c.termes.comptesBloques],
              ['−', 'Total associés', c.termes.totalAssocies],
              ['−', 'Ce que je dois', c.termes.dettes],
              ['−', 'Refus non remboursés', c.termes.refusNonRembourses],
              ['−', 'Candidats en attente', c.termes.candidatsAttente]
            ]}
            total={['Solde de contrôle', c.resultat]}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">Cohérence du capital</span><h2>Test de solvabilité</h2></div>
            <span className={'badge ' + sState[0]}>{sState[1]}</span>
          </div>
          <Statement
            lines={[
              ['+', 'Capital global', t.capital],
              ['−', `Solde ${ds[0]?.nom || 'associé 1'}`, t.nouveauSoldeMoi],
              ['−', `Solde ${ds[1]?.nom || 'associé 2'}`, t.nouveauSoldeAxel],
              ['−', 'Candidats en cours', t.candidatsEnCours]
            ]}
            total={['Solvabilité', t.solvabilite]}
          />
          <p className="footnote">Solde associé = investissement de départ + dividendes (+ excédent de contrôle pour l’associé 1).</p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">Dividendes</span><h2>Part de chaque associé</h2></div>
        </div>
        <div className="dividend-grid">
          {ds.map((d, i) => (
            <article className={'dividend d' + i} key={i}>
              <header><b>{d.nom}</b><span className="badge neutral">{pct(d.part)}</span></header>
              <strong>{money(d.gain)}</strong>
              <dl className="mini">
                <div><dt>Investissement de départ</dt><dd>{money(d.investissement)}</dd></div>
                {i === 0 && d.excedentAttribue > 0 && <div className="pos-text"><dt>Excédent attribué</dt><dd>{money(d.excedentAttribue)}</dd></div>}
                <div className="strong"><dt>Solde ajusté</dt><dd>{money(d.nouveauSolde)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
