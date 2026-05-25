// ============================================================
//  DEBT SLAYER — Config
//  Ganti SCRIPT_URL dengan URL Google Apps Script kamu
//  setelah deploy. Atau set langsung dari UI: Edit > ⚙️ Sync
// ============================================================

const CONFIG = {
  // Paste URL Apps Script kamu di sini, ATAU set dari UI app
  // Contoh: 'https://script.google.com/macros/s/AKfycby.../exec'
  SCRIPT_URL: '',

  // Interval auto-sync dalam milidetik (default: 30 detik)
  SYNC_INTERVAL: 30000,

  // Versi storage key — ubah jika ingin reset semua user
  STORAGE_KEY: 'debt-slayer-v2',
  URL_KEY: 'debt-slayer-script-url',
};
