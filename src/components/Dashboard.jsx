import React from 'react';
import { money, pct } from '../lib/format';

const BANKS = [['n26', 'N26'], ['sparkasse', 'Sparkasse Bremen'], ['commerzbank', 'Commerzbank'], ['wise', 'Wise']];

/** Relevé « + / − / = » : la formule se lit ligne par ligne. */
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
        <dd className={total[1] < 0 ? 'neg-text' : ''}>{money(total[1])}</dd>
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
    ['Capital global', t.capital, t.capital < 0 ? 'neg' : 'info', 'Ce que l’agence possède − ce qu’elle doit'],
    ['Disponible', t.disponible, 'warn', 'Total des 4 banques'],
    ['Gain net agence', t.gainNet, t.gainNet < 0 ? 'neg' : 'pos', 'Après commissions et frais visa'],
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
          <dl className="mini spaced">
            <div><dt>Commissions démarcheurs</dt><dd>{money(t.commissions)}</dd></div>
            <div><dt>Frais visa sur comptes bloqués</dt><dd>{money(t.fraisVisa)}</dd></div>
          </dl>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">Ce que l’agence possède et doit</span><h2>Capital global</h2></div>
          </div>
          <Statement
            lines={[
              ['+', 'Banques', t.banques],
              ['+', 'Comptes bloqués récupérables', t.bloque],
              ['+', 'Prêts perso (on me doit)', t.perso],
              ['−', 'Dettes (je dois)', t.dettes],
              ['−', 'Refus non remboursés', t.resteRemb],
              ['−', 'Acomptes des dossiers en cours', t.acomptesEnCours],
              ['−', 'Argent des candidats en cours', t.candidatsEnCours]
            ]}
            total={['Capital global', t.capital]}
          />
        </section>

        <div>
          <section className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">Contrôle de compte</span><h2>Solde de contrôle</h2></div>
              <span className={'badge ' + kState[0]}>{kState[1]}</span>
            </div>
            <Statement
              lines={[
                ['+', 'Capital global', c.termes.capital],
                ['−', 'Investissements des associés', c.termes.totalAssocies],
                ['−', 'Gain à distribuer', c.termes.gainDistribue]
              ]}
              total={['Solde de contrôle', c.resultat]}
            />
            <p className="footnote">Zéro : tout l’argent est expliqué. Un excédent est attribué à l’associé 1 ; un déficit signale de l’argent manquant ou une saisie à corriger.</p>
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
                ['−', `Solde ${ds[1]?.nom || 'associé 2'}`, t.nouveauSoldeAxel]
              ]}
              total={['Solvabilité', t.solvabilite]}
            />
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">Dividendes</span><h2>Part de chaque associé</h2></div>
        </div>
        {t.gainNet < 0 && <div className="alert neg">Perte de {money(-t.gainNet)} : aucun dividende n’est distribué.</div>}
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
