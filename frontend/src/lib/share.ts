// Шеринг сессии по ссылке. AES-GCM на клиенте, сервер хранит только
// шифротекст. Ключ — во фрагменте URL (#k=...), браузер фрагмент
// на сервер не отправляет.
// Перенесено 1-в-1 из static/share.js — формат совместим со старым
// бэкендом /api/share, ссылки между v1 и v2 работают одинаково.
import type { Message, Mode } from '../types';

const API = '/api/share';

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  let s = str;
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  // Явный ArrayBuffer (а не SharedArrayBuffer) — иначе TS не пропускает
  // в crypto.subtle.* (BufferSource требует именно ArrayBuffer).
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out as Uint8Array<ArrayBuffer>;
}

async function genKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return b64urlEncode(raw);
}

async function importKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64urlDecode(b64), { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
}

export interface ShareState {
  v: 1;
  topic_id: string;
  mode: Mode;
  messages: Message[];
}

export async function createShare(state: ShareState): Promise<string> {
  const key = await genKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(JSON.stringify(state));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ciphertext_b64: b64urlEncode(ct),
      iv_b64: b64urlEncode(iv),
    }),
  });
  if (!res.ok) {
    let err: { error?: string } = {};
    try {
      err = (await res.json()) as { error?: string };
    } catch {
      // не JSON, оставим status
    }
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const { id } = (await res.json()) as { id: string };
  const keyB64 = await exportKey(key);
  return `${location.origin}/?s=${id}#k=${keyB64}`;
}

export async function loadShare(): Promise<ShareState | null> {
  const params = new URLSearchParams(location.search);
  const sid = params.get('s');
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const keyB64 = hashParams.get('k');
  if (!sid || !keyB64) return null;
  const res = await fetch(`${API}/${encodeURIComponent(sid)}`);
  if (res.status === 404) throw new Error('expired');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { ciphertext_b64, iv_b64 } = (await res.json()) as {
    ciphertext_b64: string;
    iv_b64: string;
  };
  const key = await importKey(keyB64);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64urlDecode(iv_b64) },
    key,
    b64urlDecode(ciphertext_b64),
  );
  return JSON.parse(new TextDecoder().decode(pt)) as ShareState;
}
