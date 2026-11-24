import { collection, doc, getDocs, writeBatch, serverTimestamp, Firestore } from 'firebase/firestore';
import type { VoterInfo } from '@/lib/types';

export type PollSyncResult = {
  added: string[];
  removed: string[];
  /** Personas que ya no están en el grupo pero ya habían votado: se conservan en el registro. */
  keptBecauseVoted: string[];
  /** Registros repetidos de una misma persona que se limpiaron. */
  deduped: string[];
};

const fullName = (v: { nombre?: string; apellido?: string }) =>
  `${v.apellido || ''} ${v.nombre || ''}`.trim();

/**
 * Actualiza el registro de votantes de UNA votación para que coincida con los miembros del grupo.
 * Solo se ejecuta cuando el administrador lo pide (nunca automáticamente):
 *  - quien entró al grupo se agrega al registro, habilitado y marcado como «agregado después»;
 *  - quien salió del grupo y NO ha votado se quita del registro;
 *  - quien salió pero YA votó se conserva (para no romper la cuadratura de votos);
 *  - si una persona quedó repetida, se deja un solo registro.
 */
export async function syncPollWithGroup(
  firestore: Firestore,
  adminId: string,
  pollId: string,
  members: VoterInfo[]
): Promise<PollSyncResult> {
  const votersRef = collection(firestore, 'admins', adminId, 'polls', pollId, 'voters');
  const votersSnap = await getDocs(votersRef);

  type VoterDoc = { ref: (typeof votersSnap.docs)[number]['ref']; data: any };
  const byVoter = new Map<string, VoterDoc[]>();
  votersSnap.forEach(d => {
    const vid = (d.data() as any).voterId;
    const list = byVoter.get(vid) || [];
    list.push({ ref: d.ref, data: d.data() });
    byVoter.set(vid, list);
  });

  const batch = writeBatch(firestore);
  const result: PollSyncResult = { added: [], removed: [], keptBecauseVoted: [], deduped: [] };

  // Una persona repetida: se conserva un solo registro (el que ya votó, si lo hay)
  const existing = new Map<string, VoterDoc>();
  byVoter.forEach((list, vid) => {
    const keep = list.find(x => x.data.hasVoted) || list.find(x => x.data.enabled === false) || list[0];
    existing.set(vid, keep);
    list.forEach(x => {
      if (x !== keep) {
        batch.delete(x.ref);
        result.deduped.push(fullName(x.data));
      }
    });
  });

  const desired = new Map(members.map(m => [m.id, m]));

  desired.forEach((m, id) => {
    if (existing.has(id)) return;
    // ID fijo por persona: aunque se pulse dos veces, escribe el mismo documento y no se duplica
    batch.set(doc(votersRef, `v_${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}`), {
      voterId: id,
      pollId,
      hasVoted: false,
      adminId,
      enabled: true,
      nombre: m.nombre || '',
      apellido: m.apellido || '',
      agregadoDespues: true,
      agregadoAt: serverTimestamp(),
    });
    result.added.push(fullName(m));
  });

  existing.forEach((e, id) => {
    if (desired.has(id)) return;
    if (e.data.hasVoted) {
      result.keptBecauseVoted.push(fullName(e.data));
    } else {
      batch.delete(e.ref);
      result.removed.push(fullName(e.data));
    }
  });

  if (result.added.length || result.removed.length || result.deduped.length) {
    await batch.commit();
  }
  return result;
}
