import { Firestore, doc, getDoc } from 'firebase/firestore';

/**
 * Enlace personal de votación.
 * Cada voluntario retira UNA vez su enlace (un código aleatorio). En la base de datos solo
 * se guarda la huella SHA-256 del código; el código completo vive únicamente en el enlace
 * que recibe la persona. La huella no permite reconstruir el enlace.
 */

/** Clave del documento: el N° de registro sin ceros a la izquierda ni caracteres raros. */
export function linkKey(voterId: string): string {
  return String(voterId ?? '').trim().replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '');
}

export function generateToken(): string {
  const bytes = new Uint8Array(16); // 128 bits
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** ¿El código coincide con el enlace retirado por esta persona? */
export async function verifyPersonalToken(
  firestore: Firestore,
  adminId: string,
  voterId: string,
  token: string | null | undefined
): Promise<boolean> {
  if (!token || !voterId) return false;
  const key = linkKey(voterId);
  if (!key) return false;
  const snap = await getDoc(doc(firestore, 'admins', adminId, 'voterLinks', key));
  if (!snap.exists()) return false;
  const saved = snap.data()?.tokenHash;
  return typeof saved === 'string' && saved === (await hashToken(token));
}

/** Guardado en el teléfono para poder retomar sin pedir nada. */
const storeKey = (salaId: string) => `elector:enlace:${salaId}`;

export function saveStoredLink(salaId: string, voterId: string, token: string) {
  try { localStorage.setItem(storeKey(salaId), JSON.stringify({ voterId, token })); } catch { /* sin almacenamiento */ }
}

export function readStoredLink(salaId: string): { voterId: string; token: string } | null {
  try {
    const raw = localStorage.getItem(storeKey(salaId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v?.voterId && v?.token ? v : null;
  } catch { return null; }
}

export function clearStoredLink(salaId: string) {
  try { localStorage.removeItem(storeKey(salaId)); } catch { /* sin almacenamiento */ }
}
