import crypto from 'crypto';
import http from 'http';

const BASE = 'http://localhost:3001';

function computeAuthHash(email, password) {
  const sha256 = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest();
  return crypto.pbkdf2Sync(password, Buffer.concat([Buffer.from('coldfi:auth:'), sha256]), 600000, 32, 'sha512').toString('hex');
}

function deriveGroupKey(passphrase, groupId) {
  return crypto.pbkdf2Sync(passphrase, Buffer.from('coldfi-gk-' + groupId, 'utf8'), 600000, 32, 'sha512');
}

function encrypt(key, data) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  let e = c.update(JSON.stringify(data), 'utf8', 'base64');
  e += c.final('base64');
  return Buffer.concat([iv, Buffer.from(e, 'base64'), c.getAuthTag()]).toString('base64');
}

function decrypt(key, b64) {
  if (!b64) return null;
  const buf = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(buf.length - 16));
  let dec = d.update(buf.subarray(12, buf.length - 16));
  dec += d.final('utf8');
  return JSON.parse(dec);
}

function api(method, path, token, body) {
  return new Promise((resolve) => {
    const u = new URL(path, BASE);
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname, method, headers: {} };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; }
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Shared engine logic (ported)
function getSplitAmount(expense, split) {
  if (expense.splitMode === 'fixed') return split.fixedAmount || 0;
  return expense.amount * split.ratio;
}

function computeNetBalances(expenses, memberIds) {
  const pairwise = {};
  for (const id of memberIds) {
    pairwise[id] = {};
    for (const other of memberIds) if (other !== id) pairwise[id][other] = 0;
  }
  for (const expense of expenses) {
    if (expense.status === 'pending_approval') continue;
    const paidBy = expense.paidBy || expense.payerId;
    for (const split of (expense.splits || [])) {
      if (split.isPaid) continue;
      const amount = getSplitAmount(expense, split);
      if (amount <= 0) continue;
      pairwise[split.memberId] = pairwise[split.memberId] || {};
      pairwise[split.memberId][paidBy] = (pairwise[split.memberId][paidBy] || 0) + amount;
    }
  }

  // Net settlements against each other
  for (const a of memberIds) {
    for (const b of memberIds) {
      if (a === b) continue;
      const aOwesB = pairwise[a]?.[b] || 0;
      const bOwesA = pairwise[b]?.[a] || 0;
      if (aOwesB > 0 && bOwesA > 0) {
        const net = aOwesB - bOwesA;
        if (net > 0) { pairwise[a][b] = net; pairwise[b][a] = 0; }
        else if (net < 0) { pairwise[b][a] = -net; pairwise[a][b] = 0; }
        else { pairwise[a][b] = 0; pairwise[b][a] = 0; }
      }
    }
  }

  const results = [];
  for (const id of memberIds) {
    let net = 0;
    const owesTo = {};
    const owedBy = {};
    for (const [other, amt] of Object.entries(pairwise[id] || {})) {
      if (amt > 0) { owesTo[other] = amt; net += amt; }
    }
    for (const [other, amt] of Object.entries(pairwise)) {
      if (amt?.[id] > 0) { owedBy[other] = amt[id]; net -= amt[id]; }
    }
    results.push({ userId: id, net: Math.round(net * 100) / 100, owesTo, owedBy });
  }
  return results;
}

function generateMinimalTransfers(balances, currency) {
  const net = balances.filter(b => Math.abs(Math.round(b.net * 100) / 100) > 0.001)
    .map(b => ({ userId: b.userId, amount: Math.round(b.net * 100) / 100 }));
  const creditors = net.filter(b => b.amount > 0).sort((a, b) => b.amount - a.amount);
  const debtors = net.filter(b => b.amount < 0).map(b => ({ userId: b.userId, amount: Math.abs(b.amount) })).sort((a, b) => b.amount - a.amount);
  const transfers = [];
  let total = 0, ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amt = Math.min(creditors[ci].amount, debtors[di].amount);
    const r = Math.round(amt * 100) / 100;
    if (r > 0) { transfers.push({ fromUserId: debtors[di].userId, toUserId: creditors[ci].userId, amount: r, currency, relatedExpenseIds: [] }); total += r; }
    creditors[ci].amount -= amt; debtors[di].amount -= amt;
    if (creditors[ci].amount < 0.001) ci++;
    if (debtors[di].amount < 0.001) di++;
  }
  return { transfers, totalTransfers: transfers.length, totalAmount: Math.round(total * 100) / 100 };
}

async function loginOrRegister(email, password, displayName) {
  const hash = computeAuthHash(email, password);
  let res = await api('POST', '/api/auth/login', null, { email, authKeyHash: hash });
  if (res.status === 200) return res.data;
  res = await api('POST', '/api/auth/register', null, { email, authKeyHash: hash, displayName });
  if (res.status === 201) return res.data;
  // Login again after register
  res = await api('POST', '/api/auth/login', null, { email, authKeyHash: hash });
  return res.data;
}

console.log('=== E2E: Group Settlement Test ===\n');

// =============================================
// STEP 1: Create 5 test users
// =============================================
const users = [
  { email: 'alice@test.com', password: 'Alice123!', name: 'Alice' },
  { email: 'bob@test.com', password: 'Bob123!', name: 'Bob' },
  { email: 'carol@test.com', password: 'Carol123!', name: 'Carol' },
  { email: 'dave@test.com', password: 'Dave123!', name: 'Dave' },
  { email: 'eve@test.com', password: 'Eve123!', name: 'Eve' },
];

const accounts = [];
for (const u of users) {
  const acct = await loginOrRegister(u.email, u.password, u.name);
  accounts.push({ ...u, userId: acct.userId, token: acct.accessToken, personalSalt: acct.personalSalt });
  console.log(`[${acct.role === 'owner' ? 'OWNER' : 'USER'}] ${u.email} -> ${acct.userId.slice(0, 8)}...`);
}

// =============================================
// STEP 2: Alice creates a group
// =============================================
const groupPassphrase = 'group-secret-2026';
const groupSalt = crypto.randomBytes(16).toString('hex');
const verifier = crypto.createHash('sha256')
  .update(Buffer.concat([Buffer.from(groupSalt, 'hex'), Buffer.from(groupPassphrase)]))
  .digest('hex');

const alice = accounts[0];
const create = await api('POST', '/api/group/create', alice.token, {
  name: 'Test Group 5',
  passphraseVerifier: verifier,
  salt: groupSalt,
  defaultCurrency: 'USD'
});
const groupId = create.data.groupId;
console.log(`\nGroup created: ${groupId} by ${alice.email}`);

// =============================================
// STEP 3: All other users join
// =============================================
// Create ONE invite code, reuse for everyone
let inviteCode;
{
  let invResult = await api('POST', '/api/group/' + groupId + '/invites', alice.token, {});
  if (invResult.status === 201 || invResult.status === 200) {
    inviteCode = invResult.data.code;
  } else {
    // Try fetching existing invites
    const existing = await api('GET', '/api/group/' + groupId + '/invites', alice.token);
    inviteCode = existing.data.invites?.[0]?.code;
  }
}
console.log(`Invite code: ${inviteCode}`);

for (let i = 1; i < accounts.length; i++) {
  const acct = accounts[i];
  // Lookup group to get salt
  const lookup = await api('GET', '/api/group/invite/' + inviteCode, acct.token);
  const joinVerifier = crypto.createHash('sha256')
    .update(Buffer.concat([Buffer.from(lookup.data.salt, 'hex'), Buffer.from(groupPassphrase)]))
    .digest('hex');
  const join = await api('POST', '/api/group/join', acct.token, { inviteCode, passphraseVerifier: joinVerifier });
  if (join.status === 200) console.log(`  ${acct.email} joined group`);
  else console.log(`  ${acct.email} join FAILED:`, join.data);
}

// =============================================
// STEP 4: Add group expenses (various scenarios)
// =============================================
const gk = deriveGroupKey(groupPassphrase, groupId);

async function getGroupBlob(token) {
  const sync = await api('GET', '/api/group/' + groupId + '/sync', token);
  return { blob: decrypt(gk, sync.data.encryptedBlob) || { version: 1, updatedAt: new Date().toISOString(), groupId, expenses: [], categories: [], members: [], settings: {}, recurringBills: [], logs: [], settlements: [] }, clock: sync.data.vectorClock };
}

async function saveGroupBlob(token, blob, clock) {
  const enc = encrypt(gk, blob);
  return api('PUT', '/api/group/' + groupId + '/sync', token, { encryptedBlob: enc, vectorClock: clock });
}

const now = new Date();
const makeId = () => 'gxp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

// Expense 1: Alice pays $200 for dinner, split equally among 5
// Expense 2: Bob pays $100 for lunch, split among Alice, Bob, Carol (3-way)
// Expense 3: Carol pays $300 for supplies, split equally among 5
// Expense 4: Dave pays $50 for taxi, split between Dave & Eve only
// Expense 5: Eve pays $500 for hotel, Alice & Eve split 50/50

const allEmails = users.map(u => u.email);

let { blob, clock } = await getGroupBlob(alice.token);
const ts = new Date().toISOString();

// Ensure blob structure
blob.expenses = blob.expenses || [];
blob.settlements = blob.settlements || [];
blob.categories = blob.categories || [];
blob.members = blob.members || [];
blob.logs = blob.logs || [];
blob.version = 1;

// Expense 1: $200 dinner, equal split (all 5)
blob.expenses.push({
  id: makeId(), amount: 200, description: 'Team dinner', category: 'food',
  payerId: alice.email, date: '2026-06-10',
  splitMode: 'ratio',
  splits: allEmails.map(e => ({ memberId: e, ratio: 0.2, isPaid: false })),
  createdAt: ts, updatedAt: ts,
});

// Expense 2: $100 lunch (Alice, Bob, Carol only)
blob.expenses.push({
  id: makeId(), amount: 100, description: 'Team lunch', category: 'food',
  payerId: accounts[1].email, date: '2026-06-11',
  splitMode: 'ratio',
  splits: ['alice@test.com', 'bob@test.com', 'carol@test.com'].map(e => ({ memberId: e, ratio: 1/3, isPaid: false })),
  createdAt: ts, updatedAt: ts,
});

// Expense 3: $300 supplies (all 5)
blob.expenses.push({
  id: makeId(), amount: 300, description: 'Office supplies', category: 'supplies',
  payerId: accounts[2].email, date: '2026-06-12',
  splitMode: 'ratio',
  splits: allEmails.map(e => ({ memberId: e, ratio: 0.2, isPaid: false })),
  createdAt: ts, updatedAt: ts,
});

// Expense 4: $50 taxi (Dave & Eve only)
blob.expenses.push({
  id: makeId(), amount: 50, description: 'Airport taxi', category: 'transport',
  payerId: accounts[3].email, date: '2026-06-13',
  splitMode: 'ratio',
  splits: ['dave@test.com', 'eve@test.com'].map(e => ({ memberId: e, ratio: 0.5, isPaid: false })),
  createdAt: ts, updatedAt: ts,
});

// Expense 5: $500 hotel (Alice & Eve only, 50/50)
blob.expenses.push({
  id: makeId(), amount: 500, description: 'Hotel booking', category: 'travel',
  payerId: accounts[4].email, date: '2026-06-14',
  splitMode: 'ratio',
  splits: ['alice@test.com', 'eve@test.com'].map(e => ({ memberId: e, ratio: 0.5, isPaid: false })),
  createdAt: ts, updatedAt: ts,
});

blob.updatedAt = ts;
const save1 = await saveGroupBlob(alice.token, blob, clock);
if (save1.status !== 200) console.log('Save FAILED:', save1.data);
else console.log(`\n5 expenses saved (clock: ${JSON.stringify(save1.data.vectorClock)})`);

// =============================================
// STEP 5: Verify net balances
// =============================================
const { blob: freshBlob } = await getGroupBlob(alice.token);

const balances = computeNetBalances(freshBlob.expenses, allEmails);
console.log('\n=== Net Balances ===');
for (const b of balances) {
  const name = users.find(u => u.email === b.userId)?.name || b.userId;
  console.log(`  ${name}: $${b.net.toFixed(2)} (owes: ${JSON.stringify(b.owesTo)}, owed: ${JSON.stringify(b.owedBy)})`);
}

// =============================================
// STEP 6: Generate settlement suggestions
// =============================================
const { transfers } = generateMinimalTransfers(balances, 'USD');
console.log('\n=== Suggested Settlements ===');
let totalSettled = 0;
for (const t of transfers) {
  const from = users.find(u => u.email === t.fromUserId)?.name || t.fromUserId;
  const to = users.find(u => u.email === t.toUserId)?.name || t.toUserId;
  console.log(`  ${from} -> ${to}: $${t.amount.toFixed(2)}`);
  totalSettled += t.amount;
}
console.log(`Total settled: $${totalSettled.toFixed(2)}, Transfers: ${transfers.length}`);

// =============================================
// STEP 7: Create settlement proposals
// =============================================
for (const t of transfers) {
  const stl = {
    id: 'stl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    groupId, fromUserId: t.fromUserId, toUserId: t.toUserId,
    amount: t.amount, currency: 'USD',
    status: 'proposed', proposedAt: new Date().toISOString(),
    markedPaidAt: null, approvedAt: null,
    relatedExpenseIds: freshBlob.expenses.map(e => e.id),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  freshBlob.settlements.push(stl);
}
const { clock: c2 } = await getGroupBlob(alice.token);
const save2 = await saveGroupBlob(alice.token, freshBlob, c2);
if (save2.status === 200) console.log(`\n${transfers.length} settlements proposed`);

// =============================================
// STEP 8: Full settlement lifecycle
// =============================================
console.log('\n=== Settlement Lifecycle ===');
const { blob: lifecycleBlob, clock: c3 } = await getGroupBlob(alice.token);

for (const stl of lifecycleBlob.settlements) {
  // Find the debtor (fromUserId) to mark as paid
  const debtor = accounts.find(a => a.email === stl.fromUserId);
  const creditor = accounts.find(a => a.email === stl.toUserId);
  if (!debtor || !creditor) continue;

  // Step A: Debtor marks as paid
  let { blob: bA, clock: cA } = await getGroupBlob(debtor.token);
  const sA = bA.settlements.find(s => s.id === stl.id);
  if (!sA) continue;
  sA.status = 'marked_paid';
  sA.markedPaidAt = new Date().toISOString();
  sA.updatedAt = new Date().toISOString();
  const rA = await saveGroupBlob(debtor.token, bA, cA);
  const debtorName = users.find(u => u.email === debtor.email)?.name || debtor.email;
  if (rA.status === 200) console.log(`  [${debtorName}] marked $${stl.amount} as paid ✓`);

  // Step B: Creditor confirms receipt
  let { blob: bB, clock: cB } = await getGroupBlob(creditor.token);
  const sB = bB.settlements.find(s => s.id === stl.id);
  if (!sB) continue;
  sB.status = 'approved';
  sB.approvedAt = new Date().toISOString();
  sB.updatedAt = new Date().toISOString();
  const rB = await saveGroupBlob(creditor.token, bB, cB);
  const creditorName = users.find(u => u.email === creditor.email)?.name || creditor.email;
  if (rB.status === 200) console.log(`  [${creditorName}] confirmed receipt ✓`);
}

// =============================================
// STEP 9: Verify final state from multiple users
// =============================================
console.log('\n=== Final Verification ===');
for (const acct of accounts) {
  const { blob: finalBlob } = await getGroupBlob(acct.token);
  const name = users.find(u => u.email === acct.email)?.name || acct.email;
  if (!finalBlob) {
    console.log(`  [${name}] CANNOT ACCESS blob`);
    continue;
  }
  const stlCount = finalBlob.settlements?.length || 0;
  const expCount = finalBlob.expenses?.length || 0;
  const approved = finalBlob.settlements?.filter(s => s.status === 'approved').length || 0;
  const proposed = finalBlob.settlements?.filter(s => s.status === 'proposed').length || 0;
  console.log(`  [${name}] expenses=${expCount}, settlements=${stlCount} (approved=${approved}, proposed=${proposed})`);
}

// =============================================
// STEP 10: Check no data corruption across users
// =============================================
console.log('\n=== Data Integrity ===');
const { blob: aliceBlob } = await getGroupBlob(alice.token);
const { blob: bobBlob } = await getGroupBlob(accounts[1].token);

const aliceExpIds = aliceBlob.expenses.map(e => e.id).sort().join(',');
const bobExpIds = bobBlob.expenses.map(e => e.id).sort().join(',');
if (aliceExpIds === bobExpIds) console.log('  Expense IDs match across users ✓');
else console.log('  Expense ID MISMATCH!');

const aliceStlIds = aliceBlob.settlements.map(s => s.id).sort().join(',');
const bobStlIds = bobBlob.settlements.map(s => s.id).sort().join(',');
if (aliceStlIds === bobStlIds) console.log('  Settlement IDs match across users ✓');
else console.log('  Settlement ID MISMATCH!');

const aliceStlStatuses = aliceBlob.settlements.map(s => `${s.id}:${s.status}`).sort();
const bobStlStatuses = bobBlob.settlements.map(s => `${s.id}:${s.status}`).sort();
if (JSON.stringify(aliceStlStatuses) === JSON.stringify(bobStlStatuses)) console.log('  Settlement statuses consistent across users ✓');
else console.log('  Settlement status MISMATCH!');

console.log('\n=== TEST COMPLETE ===');
