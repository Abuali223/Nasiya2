// Alilazer • Firebase + Auth + Firestore
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

firebase.initializeApp(window.__FIREBASE_CONFIG__);
const auth = firebase.auth();
const db   = firebase.firestore();

let isAuthed=false, clients=[], currentClientId=null;

const money  = n => Number(n||0).toLocaleString('uz-UZ',{style:'currency',currency:'UZS',maximumFractionDigits:0});
const fmt    = d => d ? new Date(d).toLocaleDateString('uz-UZ') : '';
const nowISO = () => new Date().toISOString().slice(0,10);

function sanitizePhone(v){
  v = (v || '').replace(/\D/g,'');
  if (!v) return '';
  if (v.startsWith('998') && v.length===12) return '+'+v;
  if (v.startsWith('0')   && v.length>=10)  return '+998' + v.slice(1);
  if (v.length===9)                          return '+998' + v;
  if (v.length===12)                         return '+' + v;
  return '';
}

function setUI(on){
  isAuthed = !!on;
  $('#logoutBtn').style.display = on ? '' : 'none';
  $$('.admin-only').forEach(el => el.style.display = on ? '' : 'none');
}
setUI(false);

$('#adminLoginBtn')?.addEventListener('click', ()=> $('#adminAuth').showModal());
$$('[data-close]').forEach(b=>b.addEventListener('click',e=>e.target.closest('dialog').close()));
$('#adminAuthForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('#adm_email').value.trim();
  const pass  = $('#adm_pass').value.trim();
  try{
    await auth.signInWithEmailAndPassword(email, pass);
    $('#adminAuth').close();
  }catch(err){ alert('Kirish xatosi: '+err.message); }
});
$('#logoutBtn')?.addEventListener('click', ()=>auth.signOut());

auth.onAuthStateChanged(()=>{ setUI(!!auth.currentUser); subscribeClients(); });

let unsubClients=null;
function subscribeClients(){
  if (unsubClients){ unsubClients(); unsubClients = null; }
  unsubClients = db.collection('clients').orderBy('createdAt','desc').onSnapshot(
    snap => { clients = snap.docs.map(d=>({id:d.id, ...d.data()})); renderClients(); renderTotals(); },
    err  => alert('O‘qish xatosi: '+err.message)
  );
}

function renderTotals(){
  let totalDebt=0,totalPaid=0;
  for(const c of clients){ totalDebt += Number(c.debt||0); totalPaid += Number(c.paid||0); }
  $('#totalDebt').textContent = money(totalDebt);
  $('#totalPaid').textContent = money(totalPaid);
  $('#totalLeft').textContent = money(Math.max(totalDebt-totalPaid,0));
}

$('#search')?.addEventListener('input', renderClients);

function renderClients(){
  const tbody = $('#clientTable tbody'); if(!tbody) return;
  tbody.innerHTML = '';
  const q = ($('#search').value||'').toLowerCase();

  clients
    .filter(c => {
      const name  = (c.name || '').toLowerCase();
      const phone = (c.phone|| '').toLowerCase();
      return !q || name.includes(q) || phone.includes(q);
    })
    .forEach((c,i)=>{
      const left = Math.max(Number(c.debt||0)-Number(c.paid||0),0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${c.name||''}</td>
        <td>${c.phone||'—'}</td>
        <td>${money(c.debt||0)}</td>
        <td>${money(c.paid||0)}</td>
        <td><strong>${money(left)}</strong></td>
        <td></td>
      `;
      const cell = tr.lastElementChild;

      const view = document.createElement('button');
      view.className='chip'; view.textContent='Ko‘rish';
      view.onclick=()=>openClientDetail(c.id);
      cell.appendChild(view);

      if(isAuthed){
        const del = document.createElement('button');
        del.className='chip warn'; del.textContent='O‘chirish';
        del.onclick=()=>removeClient(c.id);
        cell.appendChild(del);
      }

      tbody.appendChild(tr);
    });
}

$('#newClientBtn')?.addEventListener('click', ()=>{
  if(!isAuthed) return alert('Avval admin sifatida kiring.');
  openClientForm();
});

function openClientForm(id=null){
  const f = $('#clientForm');
  f.reset(); f.dataset.id = id||'';
  $('#deleteClientBtn').hidden = !id;
  $('#modalTitle').textContent = id ? 'Mijozni tahrirlash' : 'Yangi mijoz';

  if(id){
    const c = clients.find(x=>x.id===id); if(!c) return;
    $('#c_name').value  = c.name || '';
    $('#c_phone').value = c.phone|| '';
    $('#c_note').value  = c.note || '';
    $('#deleteClientBtn').onclick = () => {
      if(confirm('O‘chirish?')){ removeClient(id); $('#clientModal').close(); }
    };
  }
  $('#clientModal').showModal();
}

$('#clientForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!isAuthed) return alert('Avval admin sifatida kiring.');

  const id    = e.target.dataset.id || null;
  const name  = $('#c_name').value.trim();
  const raw   = $('#c_phone').value.trim();
  const phone = raw ? sanitizePhone(raw) : '';
  const note  = $('#c_note').value.trim();
  if(!name) return;

  try{
    if(id){
      await db.collection('clients').doc(id).update({ name, phone, note });
    } else {
      await db.collection('clients').add({
        name, phone, note, debt:0, paid:0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    $('#clientModal').close();
  }catch(err){ alert('Saqlash xatosi: '+err.message); }
});

async function removeClient(id){
  if(!isAuthed) return;
  if(!confirm('Mijoz va tranzaksiyalar o‘chirilsinmi?')) return;
  const ref = db.collection('clients').doc(id);
  const txs = await ref.collection('transactions').get();
  const batch = db.batch();
  txs.forEach(d=>batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
}

function openClientDetail(id){
  currentClientId = id;
  const c = clients.find(x=>x.id===id); if(!c) return;

  $('#detailName').textContent  = c.name  || '';
  $('#detailPhone').textContent = c.phone || '';
  $('#clientDetail').showModal();

  $('#detailDebt').textContent = money(c.debt||0);
  $('#detailPaid').textContent = money(c.paid||0);
  $('#detailLeft').textContent = money(Math.max((c.debt||0)-(c.paid||0),0));

  subscribeTxns(id);
  $('#addDebtBtn').style.display = isAuthed ? '' : 'none';
  $('#addPayBtn').style.display  = isAuthed ? '' : 'none';
}

let unsubTxns=null;
function subscribeTxns(clientId){
  if(unsubTxns){ unsubTxns(); unsubTxns=null; }
  unsubTxns = db.collection('clients').doc(clientId)
    .collection('transactions').orderBy('date','desc')
    .onSnapshot(snap=>{
      const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));
      const tb = $('#txnTable tbody'); tb.innerHTML='';
      rows.forEach((t,i)=>{
        const isDebt = t.type==='qarz';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>${fmt(t.date)}</td>
          <td><span class="badge ${isDebt?'debt':'pay'}">${isDebt?'Qarz':'To‘lov'}</span></td>
          <td class="amount">${money(t.amount)}</td>
          <td>${t.note||''}</td>
          <td>${isAuthed?('<button class="chip warn" data-del="'+t.id+'">O‘chirish</button>'):''}</td>
        `;
        tr.querySelector('[data-del]')?.addEventListener('click',()=>deleteTxn(t.id));
        tb.appendChild(tr);
      });
    }, err=>alert('Txn xatosi: '+err.message));
}

$('#addDebtBtn')?.addEventListener('click', ()=>openTxn('qarz'));
$('#addPayBtn') ?.addEventListener('click', ()=>openTxn('tolov'));
function openTxn(type){
  if(!isAuthed) return alert('Avval admin sifatida kiring.');
  $('#txnForm').reset();
  $('#t_type').value = type;
  $('#t_date').value = nowISO();
  $('#txnModal').showModal();
}

$('#txnForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!isAuthed) return;
  const cId  = currentClientId; if(!cId) return;
  const type = $('#t_type').value;
  const amt  = Number($('#t_amount').value);
  const date = $('#t_date').value || nowISO();
  const note = $('#t_note').value.trim();
  if(!amt || amt<=0) return;

  const docRef = db.collection('clients').doc(cId);
  const txnRef = docRef.collection('transactions').doc();
  try{
    await db.runTransaction(async tx=>{
      const cs = await tx.get(docRef);
      if(!cs.exists) throw new Error('Mijoz topilmadi');
      let {debt=0, paid=0} = cs.data();
      if(type==='qarz') debt += amt; else paid += amt;

      tx.set(txnRef,{ id:txnRef.id, type, amount:amt, date, note, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      tx.update(docRef,{ debt, paid });
    });
    $('#txnModal').close();
  }catch(err){ alert('Qo‘shishda xato: '+err.message); }
});

async function deleteTxn(txnId){
  if(!isAuthed) return;
  if(!confirm('Tranzaksiyani o‘chirasizmi?')) return;
  const docRef = db.collection('clients').doc(currentClientId);
  const txnRef = docRef.collection('transactions').doc(txnId);
  await db.runTransaction(async tx=>{
    const cs = await tx.get(docRef);
    const ts = await tx.get(txnRef);
    let {debt=0, paid=0} = cs.data();
    const t = ts.data();
    if(t.type==='qarz') debt -= t.amount; else paid -= t.amount;
    tx.delete(txnRef);
    tx.update(docRef,{ debt:Math.max(debt,0), paid:Math.max(paid,0) });
  });
}

// Export/Import (admin only)
$('#exportBtn')?.addEventListener('click',async()=>{
  if(!isAuthed) return alert('Avval admin sifatida kiring.');
  const data = { clients: [] };
  const csnap = await db.collection('clients').get();
  for (const cdoc of csnap.docs){
    const c = { id: cdoc.id, ...cdoc.data(), transactions: [] };
    const tsnap = await db.collection('clients').doc(cdoc.id).collection('transactions').get();
    c.transactions = tsnap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.clients.push(c);
  }
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='alilazer-export.json'; a.click();
});

$('#importFile')?.addEventListener('change',async e=>{
  if(!isAuthed){ e.target.value=''; return alert('Avval admin sifatida kiring.'); }
  const f=e.target.files[0]; if(!f) return;
  try{
    const text=await f.text(); const data=JSON.parse(text);
    if(!data || !Array.isArray(data.clients)) throw new Error('Format xato');
    for (const c of data.clients){
      const cref = c.id ? db.collection('clients').doc(c.id) : db.collection('clients').doc();
      await cref.set({ name:c.name||'', phone:c.phone||'', note:c.note||'', debt:Number(c.debt||0), paid:Number(c.paid||0), createdAt:firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
      if (Array.isArray(c.transactions)){
        for (const t of c.transactions){
          const tref = db.collection('clients').doc(cref.id).collection('transactions').doc(t.id||undefined);
          await tref.set({ id:tref.id, type:t.type, amount:Number(t.amount||0), date:t.date||nowISO(), note:t.note||'', createdAt:firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
        }
      }
    }
    alert('Import tugadi');
  }catch(err){ alert('Import xatosi: '+err.message); }
  finally { e.target.value=''; }
});