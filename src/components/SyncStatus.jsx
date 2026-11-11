import React from 'react';
import { Check, CloudOff, RefreshCw, TriangleAlert, Upload } from 'lucide-react';

/** Voyant discret de synchronisation ; un appui relance la synchronisation. */
export default function SyncStatus({ online, busy, pending, error, onSync }) {
  const state = !online ? ['off', CloudOff, 'Hors ligne', 'Hors ligne : vos modifications partiront au retour du réseau.']
    : busy ? ['busy', RefreshCw, 'Synchronisation', 'Synchronisation en cours…']
    : error ? ['err', TriangleAlert, 'Non synchronisé', 'Synchronisation impossible : ' + error + ' — touchez pour réessayer.']
    : pending ? ['wait', Upload, `${pending} en attente`, `${pending} modification(s) en attente d’envoi — touchez pour envoyer.`]
    : ['ok', Check, 'À jour', 'Données à jour — touchez pour actualiser.'];
  const [tone, Icon, label, title] = state;
  return (
    <button type="button" className={'sync ' + tone} onClick={onSync} disabled={!online || busy} title={title} aria-label={title}>
      <Icon size={15} className={busy && online ? 'spin' : ''} aria-hidden="true" /><span>{label}</span>
    </button>
  );
}
