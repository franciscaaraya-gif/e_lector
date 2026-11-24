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
  /** Registros repetidos de una misma persona que se limpiaron. */
  deduped: string[];
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

    // Agrupar por persona. Si una persona quedó repetida (por ejemplo por dos sincronizaciones
    // a la vez), se conserva un solo registro (preferentemente el que ya votó) y se borran los demás.
    type VoterDoc = { ref: (typeof votersSnap.docs)[number]['ref']; data: any };
    const byVoter = new Map<string, VoterDoc[]>();
    votersSnap.forEach(d => {
      const vid = (d.data() as any).voterId;
      const list = byVoter.get(vid) || [];
      list.push({ ref: d.ref, data: d.data() });
      byVoter.set(vid, list);
    });

    const batch = writeBatch(firestore);
    const dedupedNames: string[] = [];
    const existing = new Map<string, VoterDoc>();
    byVoter.forEach((list, vid) => {
      const keep = list.find(x => x.data.hasVoted) || list.find(x => x.data.enabled === false) || list[0];
      existing.set(vid, keep);
      list.forEach(x => {
        if (x !== keep) {
          batch.delete(x.ref);
          dedupedNames.push(fullName(x.data));
        }
      });
    });
    const desired = new Map(members.map(m => [m.id, m]));
    const result: PollSyncResult = {
      pollId: pollDoc.id,
      question: poll.question || '',
      status: poll.status || '',
      added: [],
      removed: [],
      keptBecauseVoted: [],
      deduped: dedupedNames,
    };

    desired.forEach((m, id) => {
      if (existing.has(id)) return;
      // ID fijo por persona: si dos sincronizaciones corren a la vez escriben el MISMO documento
      // y no se duplica.
      batch.set(doc(votersRef, `v_${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}`), {
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

    if (result.added.length || result.removed.length || result.deduped.length) {
      await batch.commit();
    }
    if (result.added.length || result.removed.length || result.keptBecauseVoted.length || result.deduped.length) {
      results.push(result);
    }
  }

  return results;
}
