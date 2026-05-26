// ============================================================
//  DEBT SLAYER — Sync Module (CORS-safe via GET params)
// ============================================================

let syncUrl = localStorage.getItem(CONFIG.URL_KEY) || CONFIG.SCRIPT_URL || '';
let syncTimer = null;
let isSyncing = false;
let lastSyncTime = null;

// ---------- STATUS UI ----------
function setSyncStatus(status, text) {
  const dot  = document.getElementById('sync-dot');
  const txt  = document.getElementById('sync-text');
  const btn  = document.getElementById('sync-btn');
  dot.className = 'sync-dot ' + status;
  txt.textContent = text;
  btn.classList.toggle('spinning', status === 'syncing');
}

function getScriptUrl() { return syncUrl; }

function setScriptUrl(url) {
  syncUrl = url.trim();
  if (syncUrl) localStorage.setItem(CONFIG.URL_KEY, syncUrl);
  else localStorage.removeItem(CONFIG.URL_KEY);
}

// ---------- API CALLS (GET only — CORS safe) ----------
async function apiCall(params) {
  if (!syncUrl) throw new Error('No script URL');
  const qs = Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v))
    .join('&');
  const url = syncUrl + '?' + qs;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

async function loadFromSheets()     { return apiCall({ action: 'load' }); }
async function saveToSheets(data)   { return apiCall({ action: 'save', data }); }

// ---------- MANUAL SYNC ----------
async function manualSync() {
  if (!syncUrl) { openSettings(); return; }
  if (isSyncing) return;
  await doSync();
}

// ---------- AUTO SYNC LOOP ----------
function startSyncLoop() {
  if (syncTimer) clearInterval(syncTimer);
  if (!syncUrl) return;
  syncTimer = setInterval(doSync, CONFIG.SYNC_INTERVAL);
}

function stopSyncLoop() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

// ---------- CORE SYNC ----------
async function doSync() {
  if (!syncUrl || isSyncing) return;
  isSyncing = true;
  setSyncStatus('syncing', 'Menyinkronkan...');
  try {
    const remoteData = await loadFromSheets();
    if (remoteData) {
      const remoteTime = remoteData._updatedAt || 0;
      const localTime  = state._updatedAt || 0;
      if (remoteTime > localTime) {
        state = remoteData;
        saveLocal();
        renderAll();
        showToast('✅ Data diperbarui dari Google Sheets');
      } else if (localTime > remoteTime) {
        await saveToSheets(state);
        showToast('☁️ Data dikirim ke Google Sheets');
      }
    } else {
      await saveToSheets(state);
      showToast('☁️ Data pertama kali dikirim ke Sheets');
    }
    lastSyncTime = new Date();
    setSyncStatus('ok', 'Synced · ' + lastSyncTime.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }));
  } catch (err) {
    console.error('Sync error:', err);
    setSyncStatus('error', 'Sync gagal — ' + (err.message || 'cek koneksi'));
  } finally {
    isSyncing = false;
  }
}

// ---------- PUSH ONLY ----------
async function pushToSheets() {
  if (!syncUrl) return;
  try {
    setSyncStatus('syncing', 'Menyimpan...');
    await saveToSheets(state);
    lastSyncTime = new Date();
    setSyncStatus('ok', 'Saved · ' + lastSyncTime.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }));
  } catch (err) {
    setSyncStatus('error', 'Gagal simpan — ' + (err.message || 'cek koneksi'));
  }
}

// ---------- INIT ----------
async function initSync() {
  if (!syncUrl) {
    setSyncStatus('', 'Belum terhubung — tap Edit > ⚙️ untuk setup');
    return;
  }
  setSyncStatus('syncing', 'Menghubungkan ke Google Sheets...');
  await doSync();
  startSyncLoop();
}

// ---------- SETTINGS MODAL ----------
function openSettings() {
  document.getElementById('script-url-input').value = syncUrl;
  document.getElementById('test-result').style.display = 'none';
  openModal('settings');
}
function closeSettings() { closeModal('settings'); }

async function saveScriptUrl() {
  const url    = document.getElementById('script-url-input').value.trim();
  const result = document.getElementById('test-result');
  result.style.display = 'block';
  result.style.color   = 'var(--c-muted)';
  result.textContent   = '⏳ Mencoba koneksi...';

  if (!url) {
    setScriptUrl('');
    stopSyncLoop();
    setSyncStatus('', 'Sync dinonaktifkan');
    result.textContent = 'URL dihapus. Sync dinonaktifkan.';
    return;
  }

  try {
    const res = await fetch(url + '?action=load');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (json.ok !== true) throw new Error(json.error || 'Response tidak valid');
    setScriptUrl(url);
    result.style.color = 'var(--c-green)';
    result.textContent = '✅ Koneksi berhasil! Sync diaktifkan.';
    closeSettings();
    await initSync();
    startSyncLoop();
  } catch (err) {
    result.style.color = 'var(--c-red)';
    result.textContent = '❌ Gagal: ' + err.message + '. Pastikan Apps Script sudah di-deploy ulang dengan akses "Anyone".';
  }
}

// ---------- TOAST ----------
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
