import React from 'react';
import { Sheet } from './Editor.jsx';

export default function Legal({ type, onClose }) {
  return (
    <Sheet title={type === 'privacy' ? 'Confidentialité' : 'Conditions d’utilisation'} onClose={onClose}>
      {type === 'privacy' ? <>
        <p>Les données saisies sont utilisées uniquement pour le suivi administratif et financier de l’agence. L’authentification et la synchronisation sont assurées par Supabase avec des règles d’accès par utilisateur. Seul le thème d’affichage reste sur l’appareil.</p>
        <p>Vous pouvez demander la correction ou la suppression de vos données auprès de l’administrateur de l’agence. Aucune donnée n’est vendue ni utilisée à des fins publicitaires.</p>
      </> : <>
        <p>L’application est un outil interne de suivi. Chaque utilisateur protège ses identifiants et vérifie les montants avant toute décision financière. L’accès peut être suspendu en cas d’usage abusif.</p>
        <p>Les calculs affichés sont des indicateurs de gestion et ne remplacent pas un conseil juridique, fiscal ou comptable.</p>
      </>}
    </Sheet>
  );
}
