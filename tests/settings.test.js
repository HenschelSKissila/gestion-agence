import assert from 'node:assert/strict';
// Simule deux appareils (deux localStorage) partageant une même base Supabase.
const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const phone = store(), laptop = store();
const on = device => { globalThis.localStorage = device; };
const db = new Map(); let offline = false;
const client = { from: () => ({
  upsert: async row => offline ? { error: { message: 'Failed to fetch' }, status: 0 } : (db.set(row.user_id, structuredClone(row)), { error: null }),
  select: () => ({ eq: (_c, uid) => ({ maybeSingle: async () => offline ? { error: { message: 'Failed to fetch' } } : { data: db.get(uid) || null, error: null } }) })
}) };
const { normalizeSettings, readLocalSettings, saveLocalSettings, pushSettings, pullSettings, DEFAULTS } = await import('../src/lib/settings.js');

// Normalisation : texte -> nombre, clés inconnues ignorées, valeurs invalides -> défaut.
const n = normalizeSettings({ n26: '1500,50', wise: '', associe1Investissement: '2000', inconnu: 1, fraisBancairesCompteBloqueVisa: 'abc' });
assert.equal(n.n26, 1500.5); assert.equal(n.wise, 0); assert.equal(n.associe1Investissement, 2000); assert.equal(n.fraisBancairesCompteBloqueVisa, 127); assert.equal('inconnu' in n, false);

// Téléphone : saisie puis envoi ; l'ordinateur récupère tout, y compris associés et frais.
on(phone); const s1 = normalizeSettings({ n26: 1000, sparkasse: 250, associe1Investissement: 400, associe1Nom: 'Moi', fraisBancairesCompteBloqueVisa: 130 });
assert.deepEqual(await pushSettings(client, 'u1', s1, saveLocalSettings(s1, 'u1')), {});
on(laptop); const pulled = await pullSettings(client, 'u1');
assert.deepEqual(pulled.settings, s1); assert.deepEqual(readLocalSettings(), s1);

// Modification hors ligne sur l'ordinateur : conservée, puis envoyée au retour du réseau.
offline = true; const s2 = { ...s1, wise: 77 }; const ts2 = saveLocalSettings(s2, 'u1');
assert.ok((await pushSettings(client, 'u1', s2, ts2)).error);
offline = false; assert.equal((await pullSettings(client, 'u1')).settings, undefined); assert.equal(db.get('u1').data.wise, 77);
on(phone); assert.equal((await pullSettings(client, 'u1')).settings.wise, 77);

// Un autre compte ne voit rien ; un appareil d'ancienne version n'écrase pas la base.
assert.deepEqual(await pullSettings(client, 'u2'), {});
const old = store(); on(old); old.setItem('gestion-agence-settings', JSON.stringify({ n26: 5 }));
assert.equal((await pullSettings(client, 'u1')).settings.n26, 1000);
db.delete('u1'); const old2 = store(); on(old2); old2.setItem('gestion-agence-settings', JSON.stringify({ n26: 5 }));
assert.ok((await pullSettings(client, 'u1')).notice); assert.equal(db.has('u1'), false);
assert.equal(DEFAULTS.fraisBancairesCompteBloqueVisa, 127);
console.log('settings.test.js: synchronisation multi-appareils OK');
