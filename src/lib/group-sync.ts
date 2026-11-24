import { collection, doc, getDocs, query, where, writeBatch, Firestore } from 'firebase/firestore';
import type { VoterInfo } from '@/lib/types';

export type PollSyncResult = {
  pollId: string;
  question: string;
  status: string;
  added: string[];
  removed: string[];
  /** Personas que salieron del grupo pero ya habían votado: se conservan en el registro. */
  keptBecauseVoted: string[];
};

const fullName = (v: { nombre?: string; apellido?: string }) =>
  `${v.apellido || ''} ${v.nombre || ''}`.trim();

/**
 * Deja el registro de votantes de las votaciones PENDIENTES o ACTIVAS que usan este grupo
 * igual a los miembros actuales del grupo:
 *  - quien entra al grupo aparece en el registro, habilitado (se puede bloquear a mano);
 *  - quien sale del grupo se quita del registro, salvo que ya haya votado
 *    (para no romper la cuadratura de votos).
 * Es idempotente: se puede llamar varias veces seguidas.
 */
export async function syncGroupToPolls(
  firestore: Firestore,
  adminId: string,
  groupId: string,
  members: VoterInfo[]
): Promise<PollSyncResult[]> {
  // Solo un filtro en el servidor (no requiere índice); el estado se filtra aquí.
  const pollsSnap = await getDocs(
    query(collection(firestore, 'admins', adminId, 'polls'), where('groupId', '==', groupId))
  );

  const results: PollSyncResult[] = [];

  for (const pollDoc of pollsSnap.docs) {
    const poll = pollDoc.data() as { question?: string; status?: string };
    if (poll.status !== 'pending' && poll.status !== 'active') continue;
    const votersRef = collection(firestore, 'admins', adminId, 'polls', pollDoc.id, 'voters');
    const votersSnap = await getDocs(votersRef);

    const existing = new Map<string, { ref: (typeof votersSnap.docs)[number]['ref']; data: any }>();
    votersSnap.forEach(d => existing.set((d.data() as any).voterId, { ref: d.ref, data: d.data() }));
    const desired = new Map(members.map(m => [m.id, m]));

    const batch = writeBatch(firestore);
    const result: PollSyncResult = {
      pollId: pollDoc.id,
      question: poll.question || '',
      status: poll.status || '',
      added: [],
      removed: [],
      keptBecauseVoted: [],
    };

    desired.forEach((m, id) => {
      if (existing.has(id)) return;
      batch.set(doc(votersRef), {
        voterId: id,
        pollId: pollDoc.id,
        hasVoted: false,
        adminId,
        enabled: true,
        nombre: m.nombre || '',
        apellido: m.apellido || '',
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

    if (result.added.length || result.removed.length) {
      await batch.commit();
    }
    if (result.added.length || result.removed.length || result.keptBecauseVoted.length) {
      results.push(result);
    }
  }

  return results;
}
