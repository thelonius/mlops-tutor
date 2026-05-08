// Шеринг сессии по ссылке. Шифрует стейт AES-GCM на клиенте,
// сервер хранит только шифротекст. Ключ — во фрагменте URL (#k=...),
// браузер фрагмент на сервер не отправляет.

(function () {
  const API = '/api/share';

  function b64urlEncode(bytes) {
    let bin = '';
    const u8 = new Uint8Array(bytes);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(str) {
    const pad = str.length % 4;
    if (pad) str += '='.repeat(4 - pad);
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function genKey() {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  async function exportKey(key) {
    const raw = await crypto.subtle.exportKey('raw', key);
    return b64urlEncode(raw);
  }

  async function importKey(b64) {
    return crypto.subtle.importKey('raw', b64urlDecode(b64), { name: 'AES-GCM' }, false, ['decrypt']);
  }

  async function createShare(state) {
    const key = await genKey();
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder().encode(JSON.stringify(state));
    const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ciphertext_b64: b64urlEncode(ct),
        iv_b64: b64urlEncode(iv),
      }),
    });
    if (!res.ok) {
      let err = {};
      try { err = await res.json(); } catch (_) {}
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { id } = await res.json();
    const keyB64 = await exportKey(key);
    return `${location.origin}/?s=${id}#k=${keyB64}`;
  }

  async function loadShare() {
    const params = new URLSearchParams(location.search);
    const sid = params.get('s');
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
    const keyB64 = hashParams.get('k');
    if (!sid || !keyB64) return null;
    const res = await fetch(`${API}/${encodeURIComponent(sid)}`);
    if (res.status === 404) throw new Error('expired');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { ciphertext_b64, iv_b64 } = await res.json();
    const key = await importKey(keyB64);
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64urlDecode(iv_b64) },
      key,
      b64urlDecode(ciphertext_b64),
    );
    return JSON.parse(new TextDecoder().decode(pt));
  }

  window.shareApi = { createShare, loadShare };
})();
