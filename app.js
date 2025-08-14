// Mini CRM • Nasiya & Tölovlar — Vanilla JS
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const storeKey = 'nasiya-crm-v1';

let db = load();

let deferredInstallPrompt = null;

// ---------- Utils ----------
function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function money(n){ 
  const num = Number(n||0);
  return num.toLocaleString('uz-UZ', {style:'currency', currency:'UZS', maximumFractionDigits:0});
}
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
function fmtDate(d){
  if(!d) return '';
  const dt = new Date(d);
  if(!isFinite(dt)) return '';
  return dt.toLocaleDateString('uz-UZ');
}
function sanitizePhone(v){
  v = (v||'').replace(/[^\\d+]/g,'');
  if(v && !v.startsWith('+')) v = '+998' + v;
  return v;
}
document.querySelector('#viewByPhoneBtn').addEventListener('click', () => {
  const p = sanitizePhone(document.querySelector('#phoneLookup').value.trim());
  if(!p) return;
  const c = db.clients.find(x => sanitizePhone(x.phone) === p);
  if(!c) return alert('Bu telefon raqami bo‘yicha mijoz topilmadi.');
  openClientDetail(c.id); // detail modalini ochamiz (pastda read-only bo‘ladi)
});
function sanitizePhone(v){
  v = (v||'').replace(/[^\d+]/g,'');
  if(v && !v.startsWith('+')) v = '+998' + v;
  return v;
}
function load(){
  try{ return JSON.parse(localStorage.getItem(storeKey)) || { clients: [] }; }
  catch{ return { clients: [] }; }
}
function save(){
  localStorage.setItem(storeKey, JSON.stringify(db));
  render();
}
function nowISO(){ return new Date().toISOString().slice(0,10); }

// ---------- Rendering ----------
function computeTotals(){
  let totalDebt = 0, totalPaid = 0;
  for(const c of db.clients){
    const debt = sum(c.transactions.filter(t=>t.type==='qarz').map(t=>Number(t.amount)));
    const paid = sum(c.transactions.filter(t=>t.type==='tolov').map(t=>Number(t.amount)));
    totalDebt += debt; totalPaid += paid;
    // ... jadval qatorini yasagan joyda:
const delBtn = frag.querySelector('[data-remove]');
if(isLocked){
  delBtn.remove(); // qulflanganda o'chirish bo'lmaydi
} else {
  delBtn.addEventListener('click', () => removeClient(c.id));
}

// ... render() oxirida:
if(isLocked){
  document.querySelector('#newClientBtn').style.display = 'none';
  document.querySelector('#exportBtn').style.display    = 'none';
  document.querySelector('label.btn.file')?.classList.add('admin-only');
} else {
  document.querySelector('#newClientBtn').style.display = 'inline-block';
  document.querySelector('#exportBtn').style.display    = 'inline-block';
  document.querySelector('label.btn.file')?.classList.remove('admin-only');
  document.querySelector('#addDebtBtn').style.display = isLocked ? 'none' : 'inline-block';
document.querySelector('#addPayBtn').style.display  = isLocked ? 'none' : 'inline-block';
}
  }
  return { totalDebt, totalPaid, totalLeft: Math.max(totalDebt - totalPaid, 0) };
  if(isLocked) return alert('Admin rejimida emas.');
}

function render(){
  // totals
  const {totalDebt,totalPaid,totalLeft} = computeTotals();
  $('#totalDebt').textContent = money(totalDebt);
  $('#totalPaid').textContent = money(totalPaid);
  $('#totalLeft').textContent = money(totalLeft);

  // table
  const tbody = $('#clientTable tbody');
  tbody.innerHTML = '';
  const q = ($('#search').value || '').toLowerCase();
  db.clients
    .map(c => ({...c, debt: sum(c.transactions.filter(t=>t.type==='qarz').map(t=>+t.amount)),
                      paid: sum(c.transactions.filter(t=>t.type==='tolov').map(t=>+t.amount))}))
    .filter(c => {
      const phone = (c.phone||'').toLowerCase();
      const name = (c.name||'').toLowerCase();
      return !q || name.includes(q) || phone.includes(q);
    })
    .sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))
    .forEach((c, i) => {
      const tr = document.createElement('tr');
      const left = Math.max(c.debt - c.paid, 0);
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${c.name||''}</td>
        <td>${c.phone||''}</td>
        <td>${money(c.debt)}</td>
        <td>${money(c.paid)}</td>
        <td><strong>${money(left)}</strong></td>
        <td></td>
      `;
      const cell = tr.lastElementChild;
      const tpl = document.getElementById('rowActions');
      cell.appendChild(tpl.content.cloneNode(true));
      cell.querySelector('[data-view]').addEventListener('click', () => openClientDetail(c.id));
      cell.querySelector('[data-remove]').addEventListener('click', () => removeClient(c.id));
      tbody.appendChild(tr);
    });
}

// ---------- Clients ----------
$('#newClientBtn').addEventListener('click', () => openClientForm());
$('#search').addEventListener('input', render);

function openClientForm(id=null){
  if(isLocked) return alert('Admin rejimida emas.');
  const modal = $('#clientModal');
  const form = $('#clientForm');
  form.reset();
  $('#deleteClientBtn').hidden = true;
  form.dataset.id = id || '';
  $('#modalTitle').textContent = id ? 'Mijozni tahrirlash' : 'Yangi mijoz';
  if(id){
    const c = db.clients.find(x=>x.id===id);
    if(!c) return;
    $('#c_name').value = c.name || '';
    $('#c_phone').value = c.phone || '';
    $('#c_note').value = c.note || '';
    $('#deleteClientBtn').hidden = false;
    $('#deleteClientBtn').onclick = () => { if(confirm('Ushbu mijoz o‘chirilsinmi?')) { removeClient(id); modal.close(); } };
  }
  modal.showModal();
}

$('[data-close]').addEventListener('click', e=> e.target.closest('dialog').close());
$$('[data-close]').forEach(btn => btn.addEventListener('click', e=> e.target.closest('dialog').close()));

$('#clientForm').addEventListener('submit', e => {
  e.preventDefault();
  const id = e.target.dataset.id || null;
  const name = $('#c_name').value.trim();
  const phone = sanitizePhone($('#c_phone').value.trim());
  const note = $('#c_note').value.trim();
  if(!name) return;

  if(id){
    const c = db.clients.find(x=>x.id===id);
    if(!c) return;
    c.name = name; c.phone = phone; c.note = note;
  } else {
    db.clients.push({ id: uid(), name, phone, note, createdAt: new Date().toISOString(), transactions: [] });
  }
  save();
  $('#clientModal').close();
});

function removeClient(id){
  const i = db.clients.findIndex(x=>x.id===id);
  if(i>=0){ db.clients.splice(i,1); save(); }
}

// ---------- Client Detail & Transactions ----------
// Alohida tugmalar: Qarz va Tölov
$('#addDebtBtn').addEventListener('click', () => {
  $('#txnForm').reset();
  $('#t_type').value = 'qarz';
  $('#t_date').value = nowISO();
  $('#txnModal').showModal();
});

$('#addPayBtn').addEventListener('click', () => {
  $('#txnForm').reset();
  $('#t_type').value = 'tolov';
  $('#t_date').value = nowISO();
  $('#txnModal').showModal();
});

function renderDetail(){
  const c = db.clients.find(x=>x.id===currentClientId);
  if(!c) return;
  const debt = sum(c.transactions.filter(t=>t.type==='qarz').map(t=>+t.amount));
  const paid = sum(c.transactions.filter(t=>t.type==='tolov').map(t=>+t.amount));
  const left = Math.max(debt - paid, 0);
  $('#detailDebt').textContent = money(debt);
  $('#detailPaid').textContent = money(paid);
  $('#detailLeft').textContent = money(left);

  const tbody = $('#txnTable tbody');
  tbody.innerHTML = '';
  c.transactions
    .slice()
    .sort((a,b)=> (b.date||'').localeCompare(a.date||''))
    .forEach((t, i) => {
      const tr = document.createElement('tr');
      const isDebt = t.type === 'qarz';
tr.innerHTML = `
  <td>${i+1}</td>
  <td>${fmtDate(t.date)}</td>
  <td><span class="badge ${isDebt ? 'debt' : 'pay'}">${isDebt ? 'Qarz (➕)' : 'Tölov (➖)'}</span></td>
  <td class="amount ${isDebt ? 'debt' : 'pay'}">${money(t.amount)}</td>
  <td>${t.note || ''}</td>
  <td><button class="chip warn" data-del="${t.id}">O‘chirish</button></td>
`;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        if(confirm('Tranzaksiyani o‘chirasizmi?')){
          const idx = c.transactions.findIndex(x=>x.id===t.id);
          if(idx>=0){ c.transactions.splice(idx,1); save(); renderDetail(); }
        }
      });
      tbody.appendChild(tr);
    });
}

$('#addTxnBtn').addEventListener('click', () => {
  $('#txnForm').reset();
  $('#t_type').value = 'qarz';
  $('#t_date').value = nowISO();
  $('#txnModal').showModal();
});

$('#txnForm').addEventListener('submit', e => {
  e.preventDefault();
  const c = db.clients.find(x=>x.id===currentClientId);
  if(!c) return;
  const type = $('#t_type').value;
  const amount = Number($('#t_amount').value);
  const date = $('#t_date').value || nowISO();
  const note = $('#t_note').value.trim();
  if(!amount || amount<=0) return;
  c.transactions.push({ id: uid(), type, amount, date, note });
  save();
  $('#txnModal').close();
  renderDetail();
});

// ---------- Export / Import ----------
const pinKey  = 'nasiya-crm-pin';
const lockKey = 'nasiya-crm-locked';
let isLocked = JSON.parse(localStorage.getItem(lockKey) ?? 'true'); // default: qulflangan

function updateLockUI(){
  document.body.classList.toggle('locked', isLocked);
  document.querySelector('#lockState').textContent = isLocked ? '🔒 Qulf' : '🔓 Admin';
}
updateLockUI();

// SHA-256 hash (PIN’ni hashlab saqlaymiz)
async function sha256(str){
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function checkPin(pin){
  const saved = localStorage.getItem(pinKey);
  if(!saved) return false;
  return (await sha256(pin)) === saved;
}
async function setPin(pin){
  localStorage.setItem(pinKey, await sha256(pin));
}

// Qulf tugmasi
document.querySelector('#lockBtn').addEventListener('click', async () => {
  if(isLocked){
    const saved = localStorage.getItem(pinKey);
    if(!saved){
      const p1 = prompt('Yangi ADMIN PIN kiriting (kamida 4 raqam):');
      if(!p1 || p1.length < 4) return alert('Kamida 4 raqam bo‘lsin.');
      const p2 = prompt('PINni tasdiqlang:');
      if(p1 !== p2) return alert('PIN mos kelmadi.');
      await setPin(p1);
      isLocked = false;
    } else {
      const pin = prompt('ADMIN PIN:');
      if(!pin) return;
      if(!(await checkPin(pin))) return alert('Noto‘g‘ri PIN.');
      isLocked = false;
    }
  } else {
    isLocked = true;
  }
  localStorage.setItem(lockKey, JSON.stringify(isLocked));
  updateLockUI();
  render();
});
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nasiya-data.json';
  a.click();
});

$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  try{
    const data = JSON.parse(text);
    if(!data || !Array.isArray(data.clients)) throw new Error('Format xato');
    db = data; save();
    alert('Import muvaffaqiyatli!');
  }catch(err){
    alert('Importda xatolik: ' + err.message);
  } finally {
    e.target.value = '';
  }
});

// ---------- PWA install ----------
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

$('#installBtn').addEventListener('click', async () => {
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    const res = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } else {
    alert('Aʼzo bo‘lish oynasi avtomatik paydo bo‘lganda shu tugma orqali o‘rnatasiz.');
  }
});

// ---------- SW ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

// First paint
render();
