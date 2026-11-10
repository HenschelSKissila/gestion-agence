import assert from 'node:assert/strict';
import { chooseWorkspace } from '../src/lib/workspace.js';

const me = 'u-moi', boss = 'u-proprio';
// Sans partage : on travaille dans sa propre agence.
assert.deepEqual(chooseWorkspace(me, []), { id: me, own: true, canEdit: true, ownerEmail: '', shared: [], members: [] });
// Propriétaire : ses invités sont listés, il reste chez lui.
const owner = chooseWorkspace(boss, [{ owner_id: boss, owner_email: 'p@x.fr', member_email: 'a@x.fr', peut_modifier: true }]);
assert.equal(owner.id, boss); assert.equal(owner.members.length, 1); assert.equal(owner.shared.length, 0);
// Associé invité : il ouvre l'agence du propriétaire, avec les droits accordés.
const rows = [{ owner_id: boss, owner_email: 'p@x.fr', member_email: 'a@x.fr', peut_modifier: false }];
const invited = chooseWorkspace(me, rows);
assert.equal(invited.id, boss); assert.equal(invited.own, false); assert.equal(invited.canEdit, false); assert.equal(invited.ownerEmail, 'p@x.fr');
// Il peut revenir à sa propre agence, et une préférence périmée est ignorée.
assert.equal(chooseWorkspace(me, rows, me).id, me);
assert.equal(chooseWorkspace(me, rows, 'u-inconnu').id, boss);
console.log('workspace.test.js: choix de l’agence OK');
