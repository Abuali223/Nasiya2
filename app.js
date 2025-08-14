const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let db = load();
let currentClientId = null;

function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function money(n){ return Number(n||0).toLocaleString('uz-UZ',{style:'currency',currency:'UZS',maximumFractionDigits:0}); }
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
function fmtDate(d){ if(!d) return ''; return new Date(d).toLocaleDateString('uz-UZ'); }
function nowISO(){ return new Date().toISOString().slice(0,10); }

function sanitizePhone(v){
  v = v.replace(/[^0-9]/g,'');
  if(v.startsWith('998')) v = '+'+v;
  else if(v.length===9) v = '+998'+v;
  return v;
}

function load(){
  try{ return JSON.parse(localStorage.getItem('alilazer-db')) || {clients:[]}; }
  catch{ return {clients:[]}; }
}

function save(){
  localStorage.setItem('alilazer-db', JSON.stringify(db));
  render();
}

function computeTotals(){
  let totalDebt=0,totalPaid=0;
  for(const c of db.clients){
    const debt = sum(c.transactions.filter(t=>t.type==='qarz').map(t=>+t.amount));
    const paid = sum(c.transactions.filter(t=>t.type==='tolov').map(t=>+t.amount));
    totalDebt += debt; totalPaid += paid;
  }
  return { totalDebt, totalPaid, totalLeft: Math.max(totalDebt-totalPaid,0) };
}

function render(){
  const {totalDebt,totalPaid,totalLeft} = computeTotals();
  $('#totalDebt').textContent = money(totalDebt);
  $('#totalPaid').textContent = money(totalPaid);
  $('#totalLeft').textContent = money(totalLeft);

  const tbody = $('#clientTable tbody');
  tbody.innerHTML = '';
  const q = $('#search').value.toLowerCase();
  db.clients.forEach((c,i)=>{
    const debt = sum(c.transactions.filter(t=>t.type==='qarz').map(t=>+t.amount));
    const paid = sum(c.transactions.filter(t=>t.type==='tolov').map(t=>+t.amount));
    const left = Math.max(debt-paid,0);
    if(!q || c.name.toLowerCase().includes(q) || c.phone.includes(q)){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${c.name}</td>
        <td>${c.phone || '—'}</td>
        <td>${money(debt)}</td>
        <td>${money(paid)}</td>
        <td>${money(left)}</td>
        <td><button onclick="openClientDetail('${c.id}')">Ko‘rish</button></td>
      `;
      tbody.appendChild(tr);
    }
  });
}

$('#newClientBtn').onclick = ()=>openClientForm();
$('#search').oninput = render;

function openClientForm(id=null){
  const form = $('#clientForm');
  form.reset();
  form.dataset.id = id || '';
  if(id){
    const c = db.clients.find(x=>x.id===id);
    $('#c_name').value = c.name;
    $('#c_phone').value = c.phone;
    $('#c_note').value = c.note;
  }
  $('#clientModal').showModal();
}

$$('[data-close]').forEach(btn=>btn.onclick=e=>e.target.closest('dialog').close());

$('#clientForm').onsubmit = e=>{
  e.preventDefault();
  const id = e.target.dataset.id;
  const name = $('#c_name').value.trim();
  let phone = $('#c_phone').value.trim();
  phone = sanitizePhone(phone);
  const note = $('#c_note').value.trim();
  if(id){
    const c = db.clients.find(x=>x.id===id);
    c.name=name; c.phone=phone; c.note=note;
  }else{
    db.clients.push({id:uid(),name,phone,note,createdAt:nowISO(),transactions:[]});
  }
  save();
  $('#clientModal').close();
}

function openClientDetail(id){
  currentClientId = id;
  const c = db.clients.find(x=>x.id===id);
  $('#detailName').textContent = c.name;
  $('#detailPhone').textContent = c.phone;
  renderDetail();
  $('#clientDetail').showModal();
}

function renderDetail(){
  const c = db.clients.find(x=>x.id===currentClientId);
  const debt = sum(c.transactions.filter(t=>t.type==='qarz').map(t=>+t.amount));
  const paid = sum(c.transactions.filter(t=>t.type==='tolov').map(t=>+t.amount));
  const left = Math.max(debt-paid,0);
  $('#detailDebt').textContent = money(debt);
  $('#detailPaid').textContent = money(paid);
  $('#detailLeft').textContent = money(left);

  const tbody = $('#txnTable tbody');
  tbody.innerHTML = '';
  c.transactions.forEach((t,i)=>{
    tbody.innerHTML += `
      <tr>
        <td>${i+1}</td>
        <td>${fmtDate(t.date)}</td>
        <td>${t.type==='qarz'?'Qarz':'To‘lov'}</td>
        <td>${money(t.amount)}</td>
        <td>${t.note||''}</td>
        <td><button onclick="delTxn('${t.id}')">O‘chirish</button></td>
      </tr>
    `;
  });
}

$('#addDebtBtn').onclick = ()=>openTxnForm('qarz');
$('#addPayBtn').onclick = ()=>openTxnForm('tolov');

function openTxnForm(type){
  $('#txnForm').reset();
  $('#t_type').value = type;
  $('#t_date').value = nowISO();
  $('#txnModal').showModal();
}

$('#txnForm').onsubmit = e=>{
  e.preventDefault();
  const c = db.clients.find(x=>x.id===currentClientId);
  const type = $('#t_type').value;
  const amount = Number($('#t_amount').value);
  const date = $('#t_date').value;
  const note = $('#t_note').value;
  c.transactions.push({id:uid(),type,amount,date,note});
  save();
  $('#txnModal').close();
  renderDetail();
}

function delTxn(id){
  const c = db.clients.find(x=>x.id===currentClientId);
  c.transactions = c.transactions.filter(t=>t.id!==id);
  save();
  renderDetail();
}

render();