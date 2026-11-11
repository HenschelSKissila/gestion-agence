import assert from 'node:assert/strict';
// Simule plusieurs appareils (un localStorage chacun) partageant le même compte Supabase.
const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const on = device => { globalThis.localStorage = device; };
globalThis.navigator ??= { onLine: true };

function backend({ table = true } = {}) {
  const state = { rows: new Map(), profile: {}, offline: false, table };
  const fail = { error: { message: 'Failed to fetch' }, status: 0 };
  const missing = { error: { code: 'PGRST205', message: "Could not find the table 'public.parametres_utilisateur' in the schema cache" }, status: 404 };
  const client = {
    from: () => ({
      upsert: async row => state.offline ? fail : !state.table ? missing : (state.rows.set(row.user_id, structuredClone(row)), { error: null }),
      select: () => ({ eq: (_c, uid) => ({ maybeSingle: async () => state.offline ? fail : !state.table ? missing : { data: state.rows.get(uid) || null, error: null } }) })
    }),
    auth: {
      getUser: async () => state.offline ? { data: { user: null }, error: { message: 'offline' } } : { data: { user: { user_metadata: structuredClone(state.profile) } } },
      updateUser: async ({ data }) => state.offline ? { error: { message: 'Failed to fetch' } } : (Object.assign(state.profile, structuredClone(data)), { error: null })
    }
  };
  return { state, client };
}
const { normalizeSettings, readLocalSettings, saveLocalSettings, pushSettings, pullSettings, DEFAULTS } = await import('../src/lib/settings.js');

// Normalisation : texte -> nombre, clés inconnues ignorées, valeurs invalides -> défaut.
const n = normalizeSettings({ n26: '1500,50', wise: '', associe1Investissement: '2000', inconnu: 1, agencyName: 'X', logo: 'data:', fraisBancairesCompteBloqueVisa: 'abc', commissionSurRefus: false });
assert.equal(n.n26, 1500.5); assert.equal(n.wise, 0); assert.equal(n.associe1Investissement, 2000); assert.equal(n.fraisBancairesCompteBloqueVisa, 127); assert.equal(n.commissionSurRefus, false);
for (const k of ['inconnu', 'agencyName', 'logo']) assert.equal(k in n, false);
assert.equal(DEFAULTS.fraisBancairesCompteBloqueVisa, 127);

const s1 = normalizeSettings({ n26: 1000, sparkasse: 50, commerzbank: 8600, associe1Investissement: 400, associe1Nom: 'Moi', fraisBancairesCompteBloqueVisa: 130 });

for (const [label, table] of [['table parametres_utilisateur présente', true], ['table absente (schema.sql non exécuté) : profil du compte', false]]) {
  const { state, client } = backend({ table });
  const phone = store(), laptop = store();

  // Téléphone : saisie puis envoi ; l'ordinateur récupère tout, y compris associés et frais.
  on(phone); assert.deepEqual(await pushSettings(client, 'u1', s1, saveLocalSettings(s1, 'u1')), {}, label);
  on(laptop); assert.deepEqual((await pullSettings(client, 'u1')).settings, s1, label); assert.deepEqual(readLocalSettings(), s1);

  // Modification hors ligne sur l'ordinateur : conservée, puis envoyée au retour du réseau.
  state.offline = true; navigator.onLine = false;
  const s2 = { ...s1, wise: 77 }; const ts2 = saveLocalSettings(s2, 'u1');
  assert.ok((await pushSettings(client, 'u1', s2, ts2)).error, label);
  assert.deepEqual(await pullSettings(client, 'u1'), {}, label); assert.equal(readLocalSettings().wise, 77);
  state.offline = false; navigator.onLine = true;
  assert.equal((await pullSettings(client, 'u1')).settings, undefined, label);
  on(phone); assert.equal((await pullSettings(client, 'u1')).settings.wise, 77, label);

  // Un appareil d'ancienne version (cache local sans horodatage) reçoit les montants du compte.
  const old = store(); on(old); old.setItem('gestion-agence-settings', JSON.stringify({ n26: 5 }));
  assert.equal((await pullSettings(client, 'u1')).settings.n26, 1000, label);

  // Compte sans aucun paramètre distant : un vieil appareil n'écrase rien tout seul.
  const { state: vide, client: c2 } = backend({ table });
  const old2 = store(); on(old2); old2.setItem('gestion-agence-settings', JSON.stringify({ n26: 5 }));
  assert.ok((await pullSettings(c2, 'u9')).notice, label); assert.equal(vide.rows.size, 0); assert.deepEqual(vide.profile, {});
}

// Migration : des paramètres enregistrés dans le profil passent dans la table dès qu'elle existe.
{
  const { state, client } = backend({ table: false });
  on(store()); await pushSettings(client, 'u1', s1, saveLocalSettings(s1, 'u1'));
  assert.equal(state.rows.size, 0); assert.equal(state.profile.gestion_agence.data.commerzbank, 8600);
  state.table = true; on(store());
  assert.deepEqual((await pullSettings(client, 'u1')).settings, s1);
  assert.equal(state.rows.get('u1').data.commerzbank, 8600);
}

// Agence partagée : l'associé lit la table du propriétaire, jamais son propre profil.
{
  const { state, client } = backend();
  state.profile.gestion_agence = { data: { n26: 999 }, updated_at: new Date().toISOString() };
  state.rows.set('proprio', { user_id: 'proprio', data: s1, updated_at: '2026-01-01T00:00:00Z' });
  on(store()); assert.equal((await pullSettings(client, 'proprio', { own: false })).settings.n26, 1000);
}
console.log('settings.test.js: synchronisation multi-appareils OK (avec et sans table)');
