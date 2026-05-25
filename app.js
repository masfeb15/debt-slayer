// ============================================================
//  DEBT SLAYER — App Logic
// ============================================================

const LEVELS = [
  { xp:0,    num:1, name:"PEJUANG"   },
  { xp:500,  num:2, name:"PEMBERANI" },
  { xp:1000, num:3, name:"KESATRIA"  },
  { xp:2000, num:4, name:"PAHLAWAN"  },
  { xp:3500, num:5, name:"LEGENDA"   },
];

// ===== STATE =====
let state = loadLocal();
let currentDebtId = null;

function loadLocal() {
  try {
    const s = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveLocal() {
  state._updatedAt = Date.now();
  try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}

// ===== UTILS =====
function fRp(n) {
  n = Math.round(n);
  if (n >= 1000000) return 'Rp' + (n/1000000).toFixed(1).replace('.',',') + ' jt';
  if (n >= 1000)    return 'Rp' + Math.round(n/1000) + ' rb';
  return 'Rp' + n.toLocaleString('id-ID');
}
function fRpFull(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function getTotalLiving() { return state.livingItems.reduce((s,i) => s + i.amount, 0); }

function getLevelInfo(xp) {
  let cur = LEVELS[0], idx = 0;
  for (let i = 0; i < LEVELS.length; i++) { if (xp >= LEVELS[i].xp) { cur = LEVELS[i]; idx = i; } }
  return { ...cur, next: LEVELS[idx+1] || null, prevXp: cur.xp };
}

// ===== RENDER =====
function renderHeader() {
  const info = getLevelInfo(state.xp);
  document.getElementById('lv-num').textContent = info.num;
  document.getElementById('lv-name').textContent = info.name;
  const nextXp = info.next ? info.next.xp : info.prevXp + 1000;
  const pct = info.next ? Math.round(((state.xp - info.prevXp) / (nextXp - info.prevXp)) * 100) : 100;
  document.getElementById('xp-fill').style.width = pct + '%';
  document.getElementById('xp-current').textContent = state.xp + ' XP';
  document.getElementById('xp-next').textContent = info.next ? '/ ' + nextXp + ' XP' : 'MAX!';
}

function renderStats() {
  const active = state.debts.filter(d => !d.done);
  const total = active.reduce((s,d) => s + (d.nominal - d.paid), 0);
  document.getElementById('s-total').textContent = total > 0 ? fRp(total) : '🎉 CLEAR!';
  document.getElementById('s-lunas').textContent = state.debts.filter(d => d.done).length;
  document.getElementById('s-sisa').textContent = active.length;
  document.getElementById('s-gaji').textContent = fRp(state.gaji);
}

function renderDebts() {
  const urgOrd = { urgent:0, soon:1, safe:2 };
  const sorted = [...state.debts].sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (urgOrd[a.urgency] !== urgOrd[b.urgency]) return urgOrd[a.urgency] - urgOrd[b.urgency];
    return a.nominal - b.nominal;
  });

  document.getElementById('debt-list').innerHTML = sorted.map(d => {
    const sisa = d.nominal - d.paid;
    const pct = Math.round((d.paid / d.nominal) * 100);
    const badgeClass = d.done ? 'done-badge' : d.urgency;
    const badgeText = d.done ? 'LUNAS ✓' : d.urgency==='urgent' ? '⚠ MENDESAK' : d.urgency==='soon' ? '⏰ SEGERA' : '✅ AMAN';
    return `
      <div class="debt-card ${d.done ? 'done' : d.urgency}">
        <div class="dc-top">
          <span class="dc-name">${d.name}</span>
          <span class="dc-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="dc-amount">${d.done ? fRpFull(d.nominal) : fRpFull(sisa)}</div>
        <div class="dc-meta">
          <span>📅 ${d.end}</span>
          <span>⚡ +${d.xp} XP</span>
          ${d.paid > 0 && !d.done ? `<span>✓ ${fRp(d.paid)} dibayar</span>` : ''}
        </div>
        <div class="dc-progress-wrap"><div class="dc-progress-fill" style="width:${pct}%"></div></div>
        <div class="dc-actions">
          ${d.done
            ? '<span class="btn-done-tag">✅ HUTANG INI SUDAH LUNAS!</span>'
            : `<button class="btn-pay" onclick="openPay(${d.id})">⚔️ BAYAR SEKARANG</button>`}
        </div>
      </div>`;
  }).join('');
}

function renderBudget() {
  const gaji = state.gaji;
  const living = getTotalLiving();
  const surplus = gaji - living;
  document.getElementById('surplus-val').textContent = fRpFull(surplus);
  document.getElementById('surplus-sub').textContent = surplus >= 0
    ? `Sisa ${fRpFull(surplus)} setelah kebutuhan pokok ${fRpFull(living)}`
    : `⚠ Kebutuhan melebihi gaji sebesar ${fRpFull(Math.abs(surplus))}!`;

  const items = [
    { icon:'🙏', name:'GIVING',    pct:10, color:'#a855f7', note:'Sedekah, zakat, donasi.' },
    { icon:'🐖', name:'SAVING',    pct:30, color:'#22c55e', note:'Prioritas: dana darurat dulu!' },
    { icon:'📈', name:'INVESTING', pct:30, color:'#06b6d4', note:'Investasi jangka panjang.' },
    { icon:'🏠', name:'LIVING',    pct:30, color:'#eab308', note:'Kebutuhanmu ~' + Math.round(living/gaji*100) + '% dari gaji.' },
  ];
  document.getElementById('budget-grid').innerHTML = items.map(item => {
    const amt = Math.round(gaji * item.pct / 100);
    return `<div class="budget-card">
      <div class="bc-icon">${item.icon}</div>
      <div class="bc-name">${item.name} ${item.pct}%</div>
      <div class="bc-pct">${fRpFull(amt)}</div>
      <div class="bc-amt">/bulan</div>
      <div class="bc-bar" style="background:${item.color};width:${Math.min(item.pct*3, 100)}%"></div>
      <div class="bc-note">${item.note}</div>
    </div>`;
  }).join('');

  const livingPct = Math.round(living/gaji*100);
  document.getElementById('budget-warning').innerHTML = livingPct > 30
    ? `⚠️ Kebutuhan pokokmu (${livingPct}%) melebihi target 30%. Sementara hutang belum lunas, mulai Saving & Investing dari Rp 50–100rb/bulan untuk membangun kebiasaan. Fokus surplus ke hutang dulu!`
    : `✅ Kebutuhan pokokmu (${livingPct}%) dalam batas sehat. Kamu punya ruang untuk konsisten jalankan prinsip 10/30/30/30!`;
}

function renderInsight() {
  const active = state.debts.filter(d => !d.done);
  const totalSisa = active.reduce((s,d) => s + (d.nominal - d.paid), 0);
  const gaji = state.gaji;
  const living = getTotalLiving();
  const surplus = gaji - living;
  const biggest = [...active].sort((a,b) => (b.nominal-b.paid)-(a.nominal-a.paid))[0];
  const junDebts = state.debts.filter(d => d.end==='Jun 2026' && !d.done);
  const lastDebt = [...state.debts].sort((a,b) => {
    const m = {Jan:1,Feb:2,Mar:3,Apr:4,Mei:5,Jun:6,Jul:7,Agu:8,Sep:9,Okt:10,Nov:11,Des:12};
    const p = s => { const [mo,yr]=s.split(' '); return parseInt(yr)*100+(m[mo]||0); };
    return p(b.end)-p(a.end);
  })[0];

  const ins = [];
  if (active.length === 0) {
    ins.push({t:'good', title:'🏆 SELAMAT! KAMU DEBT FREE!', text:'Semua hutang lunas! Saatnya membangun kekayaan. Jalankan 10/30/30/30 penuh dan mulai investasi untuk masa depan.'});
  } else {
    if (junDebts.length > 0) ins.push({t:'fire', title:'🔥 JUNI 2026: Bulan Pembantaian!', text:`${junDebts.length} hutang berakhir bulan ini. Bayar semua tepat waktu = bebas dari ${junDebts.length} beban sekaligus. Total: ${fRpFull(junDebts.reduce((s,d)=>s+(d.nominal-d.paid),0))}.`});
    if (biggest) ins.push({t:'warn', title:`⚡ MUSUH TERBESAR: ${biggest.name}`, text:`Senilai ${fRpFull(biggest.nominal-biggest.paid)} — ${Math.round((biggest.nominal/totalSisa)*100)}% dari total hutangmu. Kalahkan ini, kamu langsung merasakan beban berkurang drastis.`});
    if (surplus > 0) {
      const target = living * 3;
      const months = Math.ceil(target / Math.max(surplus*0.3, 1));
      ins.push({t:'good', title:`🛡️ DANA DARURAT: Target ${fRp(target)}`, text:`Dana darurat ideal = 3× pengeluaran bulanan. Setelah hutang jangka pendek beres, alihkan min. ${fRp(surplus*0.3)}/bulan ke dana darurat. Target tercapai ~${months} bulan!`});
    }
    if (lastDebt) ins.push({t:'magic', title:`🚀 FREEDOM DATE: ${lastDebt.end}`, text:`Hutang terakhirmu (${lastDebt.name}) selesai ${lastDebt.end}. Setelah itu kamu 100% debt-free dan siap membangun kekayaan nyata dengan full prinsip 10/30/30/30!`});
  }

  document.getElementById('insight-list').innerHTML = ins.map(i => `
    <div class="insight-card ${i.t}">
      <div class="ic-title">${i.title}</div>
      <div class="ic-text">${i.text}</div>
    </div>`).join('');
}

function renderTrophy() {
  document.getElementById('trophy-list').innerHTML = state.achievements.map(a => `
    <div class="trophy-card ${a.unlocked ? 'unlocked' : ''}">
      <div class="trophy-icon">${a.icon}</div>
      <div>
        <div class="trophy-name">${a.name}</div>
        <div class="trophy-desc">${a.desc}</div>
      </div>
      <div class="trophy-status">${a.unlocked ? '✅ DONE' : '🔒 LOCKED'}</div>
    </div>`).join('');
}

function renderPoace() {
  const items = [
    {l:'P', w:'Planning',    t:`Tujuanmu jelas: debt-free → dana darurat → tabungan & investasi. Prinsip 10/30/30/30 adalah rencana alokasi yang solid. App ini membantu breakdown setiap hutang berdasarkan deadline dan urgency.`},
    {l:'O', w:'Organizing',  t:`Kelompokkan hutang per urgency (Mendesak/Segera/Aman). Alokasikan surplus bulanan ke hutang paling mendesak. Gunakan fitur Edit untuk catat semua perubahan data secara real-time.`},
    {l:'A', w:'Actuating',   t:`Bayar tepat waktu setiap bulan. Jika ada rezeki ekstra, langsung hajar hutang terdekat deadlinenya. Action kecil yang konsisten mengalahkan rencana besar yang tidak dijalankan.`},
    {l:'C', w:'Controlling', t:`Pantau saldo hutang tiap bulan. Cek tab Budget jika living overrun. Data tersinkron ke Google Sheets — bisa dipantau dari perangkat manapun kapanpun.`},
    {l:'E', w:'Evaluating',  t:`Tiap awal bulan: hutang mana yang lunas? Budget mana yang overrun? Apakah dana darurat berjalan? Review insight dan sesuaikan strategi. Fleksibilitas adalah kunci evaluasi efektif.`},
  ];
  document.getElementById('poace-list').innerHTML = items.map(i => `
    <div class="poace-card">
      <div class="poace-header"><span class="poace-letter">${i.l}</span><span class="poace-word">${i.w}</span></div>
      <div class="poace-text">${i.t}</div>
    </div>`).join('') + `
    <div class="poace-verdict">✅ <strong>Kesimpulan:</strong> POACE sangat cocok! 10/30/30/30 adalah <em>Planning</em>-nya. Debt Slayer + Google Sheets adalah <em>Controlling & Evaluating</em>-nya. Yang terpenting: mulai <em>Actuating</em> hari ini.</div>`;
}

function renderAll() {
  renderHeader(); renderStats(); renderDebts();
  renderBudget(); renderInsight(); renderTrophy(); renderPoace();
}

// ===== TABS =====
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
}

// ===== PAY =====
function openPay(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return;
  currentDebtId = id;
  document.getElementById('pay-title').textContent = '⚔️ BAYAR: ' + d.name.toUpperCase();
  document.getElementById('pay-info').innerHTML = `<strong>${d.name}</strong><br>Deadline: ${d.end} &nbsp;·&nbsp; Sisa: ${fRpFull(d.nominal - d.paid)}${d.paid > 0 ? '<br>Sudah dibayar: ' + fRpFull(d.paid) : ''}`;
  document.getElementById('pay-input').value = d.nominal - d.paid;
  openModal('pay');
}
function closePay() { closeModal('pay'); currentDebtId = null; }

function confirmPay() {
  if (currentDebtId === null) return;
  const d = state.debts.find(x => x.id === currentDebtId);
  const amt = parseInt(document.getElementById('pay-input').value) || 0;
  if (amt <= 0) { showToast('⚠ Masukkan nominal yang valid'); return; }

  const prevLvl = getLevelInfo(state.xp).num;
  d.paid = Math.min(d.paid + amt, d.nominal);

  if (d.paid >= d.nominal) {
    d.done = true;
    state.xp += d.xp;
    checkAchievements(d);
    closePay();
    showReward(d);
    const newLvl = getLevelInfo(state.xp).num;
    if (newLvl > prevLvl) setTimeout(() => showLevelUp(newLvl), 2800);
  } else {
    showToast(`💸 Pembayaran ${fRpFull(amt)} dicatat`);
    closePay();
  }

  saveLocal();
  renderAll();
  pushToSheets();
}

// ===== ACHIEVEMENTS =====
function checkAchievements(d) {
  const done = state.debts.filter(x => x.done);
  tryUnlock('first', done.length >= 1);
  tryUnlock('half', done.length >= Math.ceil(state.debts.length / 2));
  tryUnlock('freedom', done.length === state.debts.length);
  tryUnlock('naga', d.name.toLowerCase().includes('gadai'));
  const junTotal = state.debts.filter(x => x.end === 'Jun 2026');
  const junDone  = junTotal.filter(x => x.done);
  tryUnlock('jun_clear', junTotal.length > 0 && junDone.length === junTotal.length);
}
function tryUnlock(id, cond) {
  const a = state.achievements.find(x => x.id === id);
  if (a && !a.unlocked && cond) { a.unlocked = true; showToast('🏆 Achievement unlocked: ' + a.name); }
}

// ===== POPUPS =====
function showReward(d) {
  const emojis = { urgent:'⚡', soon:'🔥', safe:'✨' };
  document.getElementById('reward-emoji').textContent = emojis[d.urgency] || '🎉';
  document.getElementById('reward-title').textContent = d.name.toUpperCase() + ' LUNAS!';
  document.getElementById('reward-xp').textContent = '+' + d.xp + ' XP';
  document.getElementById('reward-sub').textContent = 'Satu musuh telah ditaklukkan!';
  const o = document.getElementById('reward-overlay');
  o.classList.add('show');
  setTimeout(() => o.classList.remove('show'), 2500);
}
function showLevelUp(num) {
  const info = LEVELS.find(l => l.num === num) || LEVELS[LEVELS.length-1];
  document.getElementById('lu-level').textContent = 'LV ' + num;
  document.getElementById('lu-name').textContent = info.name;
  const o = document.getElementById('levelup-overlay');
  o.classList.add('show');
  setTimeout(() => o.classList.remove('show'), 3000);
}

// ===== EDIT MENU =====
function openEditMenu() { openModal('edit'); }
function closeEditMenu() { closeModal('edit'); }

// ===== ADD DEBT =====
function openAddDebt() { openModal('add'); }
function closeAddDebt() { closeModal('add'); }
function confirmAddDebt() {
  const name    = document.getElementById('add-name').value.trim();
  const nominal = parseInt(document.getElementById('add-nominal').value) || 0;
  const end     = document.getElementById('add-end').value.trim();
  const urgency = document.getElementById('add-urgency').value;
  if (!name || nominal <= 0 || !end) { showToast('⚠ Isi semua field'); return; }
  const xp = Math.min(200, Math.max(50, Math.round(nominal/10000)*10));
  state.debts.push({ id: state.nextId++, name, nominal, paid:0, end, urgency, xp, done:false });
  document.getElementById('add-name').value = '';
  document.getElementById('add-nominal').value = '';
  document.getElementById('add-end').value = '';
  closeAddDebt();
  saveLocal(); renderAll(); pushToSheets();
  switchTab('misi');
  showToast('⚔️ Hutang baru ditambahkan');
}

// ===== EDIT INCOME =====
function openEditIncome() { document.getElementById('income-input').value = state.gaji; openModal('income'); }
function closeEditIncome() { closeModal('income'); }
function confirmEditIncome() {
  const val = parseInt(document.getElementById('income-input').value) || 0;
  if (val <= 0) { showToast('⚠ Masukkan nominal valid'); return; }
  state.gaji = val;
  closeEditIncome(); saveLocal(); renderAll(); pushToSheets();
  showToast('💰 Income diperbarui');
}

// ===== EDIT LIVING =====
function openEditLiving() { renderLivingList(); openModal('living'); }
function closeEditLiving() { closeModal('living'); }
function renderLivingList() {
  const total = getTotalLiving();
  document.getElementById('living-list').innerHTML =
    `<div class="li-total"><span>Total kebutuhan pokok:</span><span>${fRpFull(total)}</span></div>` +
    state.livingItems.map(item => `
      <div class="living-item">
        <span class="li-name">${item.name}</span>
        <span class="li-amount">${fRpFull(item.amount)}</span>
        <button class="li-del" onclick="deleteLiving(${item.id})">✕</button>
      </div>`).join('');
}
function addLivingItem() {
  const name = document.getElementById('living-name').value.trim();
  const amt  = parseInt(document.getElementById('living-amount').value) || 0;
  if (!name || amt <= 0) { showToast('⚠ Isi nama dan nominal'); return; }
  state.livingItems.push({ id: state.livingNextId++, name, amount: amt });
  document.getElementById('living-name').value = '';
  document.getElementById('living-amount').value = '';
  renderLivingList(); saveLocal(); renderAll(); pushToSheets();
}
function deleteLiving(id) {
  state.livingItems = state.livingItems.filter(x => x.id !== id);
  renderLivingList(); saveLocal(); renderAll(); pushToSheets();
}

// ===== MANAGE DEBTS =====
function openManageDebts() { renderManageList(); openModal('manage'); }
function closeManageDebts() { closeModal('manage'); }
function renderManageList() {
  const colors = { urgent:'#ef4444', soon:'#eab308', safe:'#22c55e' };
  document.getElementById('manage-list').innerHTML = state.debts.map(d => `
    <div class="manage-item">
      <div class="mi-dot" style="background:${d.done ? '#6b6b85' : colors[d.urgency]}"></div>
      <span class="mi-name">${d.name}${d.done ? ' ✓' : ''}</span>
      <span class="mi-amount">${fRp(d.nominal - d.paid)}</span>
      <button class="mi-del" onclick="deleteDebt(${d.id})">✕</button>
    </div>`).join('');
}
function deleteDebt(id) {
  if (!confirm('Hapus hutang ini dari daftar?')) return;
  state.debts = state.debts.filter(x => x.id !== id);
  renderManageList(); saveLocal(); renderAll(); pushToSheets();
  showToast('🗑 Hutang dihapus');
}

// ===== RESET =====
function confirmReset() {
  if (!confirm('Reset semua data ke default? Ini akan menghapus semua progress!')) return;
  state = JSON.parse(JSON.stringify(DEFAULT_DATA));
  saveLocal(); renderAll(); pushToSheets();
  showToast('🔄 Data direset ke default');
}

// ===== MODAL HELPERS =====
function openModal(name) {
  document.getElementById(name+'-overlay').classList.add('open');
  document.getElementById(name+'-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(name) {
  document.getElementById(name+'-overlay').classList.remove('open');
  document.getElementById(name+'-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== INIT =====
renderAll();
initSync();
