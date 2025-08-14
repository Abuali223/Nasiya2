// Alilazer • Nasiya & Tölovlar — Parolsiz (doimiy admin) lokal versiya
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const storeKey = 'nasiya-crm-v1';

let db = load();
let deferredInstallPrompt = null;
let currentClientId = null;

// ========== Utils ==========
function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function money(n){
  const num = Number(n||0);
  return num.toLocaleString('uz-UZ', { style:'currency', currency:'UZS', maximumFractionDigits:0 });
}
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
function fmtDate(d){
  if(!d) return '';
  const dt = new Date(d);
  if(!isFinite(dt)) return '';
  return dt.toLocaleDateString('uz-UZ');
}
function nowISO(){ return new Date().toISOString().slice(0,10); }
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

// ========== Doimiy ADMIN rejimi (qulfsiz) ==========
function updateLockUI(){
  document.body.classList.remove('locked');               // hech qachon qulflanmaydi
  $$('.admin-only').forEach(el => el.style.display = ''); // hammasi ko'rinsin
  $('#lockState') && ($('#lockState').textContent = '🔓 Admin');
}
updateLockUI();

// Agar HTML’da “Qulf” tugmasi qolgan bo‘lsa — bosilganda shunchaki xabar beradi
$('#lockBtn')?.addEventListener('click', () => {
  alert('Bu versiyada qulflash o‘chirib qo‘yilgan (doimiy admin).');
});

// ========== Rendering ==========
function computeTotals(){
  let totalDebt = 0, totalPaid = 0;
  for(const c of db.clients){
    const debt = sum(c.transactions.filter(t=>t.type==='qarz').map(t=>Number(t.amount)));
    const paid = sum(c.transactions.filter(t=>t.type==='tolov').map(t=>Number(t.amount)));
    totalDebt += debt; totalPaid += paid;
  }
  return { totalDebt, totalPaid, totalLeft: Math.max(totalDebt - totalPaid, 0) };
}

function render(){
  const { totalDebt, totalPaid, totalLeft } = computeTotals();
  $('#totalDebt').textContent = money(totalDebt);
  $('#totalPaid').textContent = money(totalPaid);
  $('#totalLeft').textContent = money(totalLeft);

  const tbody = $('#clientTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';

  const q = ($('#search')?.value || '').toLowerCase();

  db.clients
    .map(c => ({
      ...c,
      debt: sum(c.transactions.filter(t=>t.type==='qarz').map(t=>+t.amount)),
      paid: sum(c.transactions.filter(t=>t.type==='tolov').map(t=>+t.amount))
    }))
    .filter(c => {
      const phone = (c.phone||'').toLowerCase();
      const name  = (c.name ||'').toLowerCase();
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

      // Har doim admin: Ko‘rish + O‘chirish
      const viewBtn = document.createElement('button');
      viewBtn.className = 'chip';
      viewBtn.textContent = 'Ko‘rish';
      viewBtn.addEventListener('click', () => openClientDetail(c.id));
      cell.appendChild(viewBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'chip warn';
      delBtn.textContent = 'O‘chirish';
      delBtn.addEventListener('click', () => removeClient(c.id));
      cell.appendChild(delBtn);

      tbody.appendChild(tr);
    });
}

// ========== Clients ==========
$('#newClientBtn')?.addEventListener('click', () => openClientForm());
$('#search')?.addEventListener('input', render);

// (ixtiyoriy) Telefon bilan tez ko‘rish — lokal bazadan topadi
$('#viewByPhoneBtn')?.addEventListener('click', () => {
  const p = sanitizePhone($('#phoneLookup').value?.trim());
  if(!p) return;
  const c = db.clients.find(x => sanitizePhone(x.phone) === p);
  if(!c) return alert('Bu telefon raqami bo‘yicha mijoz topilmadi.');
  openClientDetail(c.id);
});

function openClientForm(id=null){
  const modal = $('#clientModal');
  const form  = $('#clientForm');
  form.reset();
  $('#deleteClientBtn').hidden = true;
  form.dataset.id = id || '';
  $('#modalTitle').textContent = id ? 'Mijozni tahrirlash' : 'Yangi mijoz';

  if(id){
    const c = db.clients.find(x=>x.id===id);
    if(!c) return;
    $('#c_name').value  = c.name  || '';
    $('#c_phone').value = c.phone || '';
    $('#c_note').value  = c.note  || '';
    $('#deleteClientBtn').hidden = false;
    $('#deleteClientBtn').onclick = () => {
      if(confirm('Ushbu mijoz o‘chirilsinmi?')) { removeClient(id); modal.close(); }
    };
  }
  modal.showModal();
}

$$('[data-close]').forEach(btn => btn.addEventListener('click', e => e.target.closest('dialog').close()));

$('#clientForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const id    = e.target.dataset.id || null;
  const name  = $('#c_name').value.trim();
  const phone = sanitizePhone($('#c_phone').value.trim());
  const note  = $('#c_note').value.trim();
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
  if(!confirm('Mijoz va barcha tranzaksiyalari o‘chirilsinmi?')) return;
  const i = db.clients.findIndex(x=>x.id===id);
  if(i>=0){ db.clients.splice(i,1); save(); }
}

// ========== Client Detail & Transactions ==========
function openClientDetail(id){
  const c = db.clients.find(x=>x.id===id);
  if(!c) return;
  currentClientId = id;
  $('#detailName').textContent  = c.name  || '';
  $('#detailPhone').textContent = c.phone || '';
  renderDetail();
  $('#clientDetail').showModal();
}

function renderDetail(){
  const c = db.clients.find(x=>x.id===currentClientId);
  if(!c) return;

  const debt = sum(c.transactions.filter(t=>t.type==='qarz').map(t=>+t.amount));
  const paid = sum(c.transactions.filter(t=>t.type==='tolov').map(t=>+t.amount));
  const left = Math.max(debt - paid, 0);

  $('#detailDebt').textContent = money(debt);
  $('#detailPaid').textContent = money(paid);
  $('#detailLeft').textContent = money(left);

  // “+ Qarz / + Tölov” tugmalari har doim ko‘rinsin
  $('#addDebtBtn') && ($('#addDebtBtn').style.display = 'inline-block');
  $('#addPayBtn')  && ($('#addPayBtn').style.display  = 'inline-block');

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
      tr.querySelector('[data-del]')?.addEventListener('click', () => {
        if(confirm('Tranzaksiyani o‘chirasizmi?')){
          const idx = c.transactions.findIndex(x=>x.id===t.id);
          if(idx>=0){ c.transactions.splice(idx,1); save(); renderDetail(); }
        }
      });
      tbody.appendChild(tr);
    });
}

$('#addDebtBtn')?.addEventListener('click', () => {
  $('#txnForm').reset();
  $('#t_type').value = 'qarz';
  $('#t_date').value = nowISO();
  $('#txnModal').showModal();
});
$('#addPayBtn')?.addEventListener('click', () => {
  $('#txnForm').reset();
  $('#t_type').value = 'tolov';
  $('#t_date').value = nowISO();
  $('#txnModal').showModal();
});

$('#txnForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const c = db.clients.find(x=>x.id===currentClientId);
  if(!c) return;
  const type   = $('#t_type').value;
  const amount = Number($('#t_amount').value);
  const date   = $('#t_date').value || nowISO();
  const note   = $('#t_note').value.trim();
  if(!amount || amount <= 0) return;

  c.transactions.push({ id: uid(), type, amount, date, note });
  save();
  $('#txnModal').close();
  renderDetail();
});

// ========== Export / Import ==========
$('#exportBtn')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'alilazer-data.json';
  a.click();
});

$('#importFile')?.addEventListener('change', async e => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
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

// ========== PWA install (ixtiyoriy) ==========
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});
$('#installBtn')?.addEventListener('click', async () => {
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } else {
    alert('Uy ekraniga qo‘shish oynasi paydo bo‘lganda shu tugmani bosing.');
  }
});

// ========== Service Worker (ixtiyoriy) ==========
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}

// First paint
render();