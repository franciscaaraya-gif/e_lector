'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { VoterGroup } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import GroupDetailsLoading from './loading';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function GroupDetailsPage() {
  const { groupId } = useParams() as { groupId: string };
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !user || !groupId) return null;
    return doc(firestore, 'admins', user.uid, 'groups', groupId);
  }, [firestore, user, groupId]);

  const { data: group, isLoading, error } = useDoc<VoterGroup>(groupRef);

  const handleVoterStatusChange = async (voterId: string, newStatus: boolean) => {
    if (!firestore || !user || !group || !groupRef || !groupId) return;

    const updatedVoters = group.voters.map(v =>
        v.id === voterId ? { ...v, enabled: newStatus } : v
    );

    try {
        const batch = writeBatch(firestore);

        // 1. Update the main group document
        batch.update(groupRef, { voters: updatedVoters });

        // 2. Propagate change to all active polls that use this group.
        // This approach fetches all polls and filters client-side to avoid
        // requiring a composite index on Firestore, making it more robust.
        const pollsRef = collection(firestore, 'admins', user.uid, 'polls');
        const allPollsSnapshot = await getDocs(pollsRef);
        const activePollDocs = allPollsSnapshot.docs.filter(doc => {
            const pollData = doc.data();
            return pollData.groupId === groupId && pollData.status === 'active';
        });

        for (const pollDoc of activePollDocs) {
            const votersSubcollectionRef = collection(pollDoc.ref, 'voters');
            const voterInPollQuery = query(votersSubcollectionRef, where('voterId', '==', voterId), limit(1));
            const voterSnapshot = await getDocs(voterInPollQuery);

            if (!voterSnapshot.empty) {
                const voterDocToUpdateRef = voterSnapshot.docs[0].ref;
                batch.update(voterDocToUpdateRef, { enabled: newStatus });
            }
        }
        
        await batch.commit();

        toast({
            title: "Estado del votante actualizado",
            description: `El estado se actualizó en el grupo y en ${activePollDocs.length} encuesta(s) activa(s).`,
        });
    } catch (err: any) {
        let description = "No se pudo cambiar el estado del votante.";
        // Check for missing Firestore index error, which can happen with complex queries
        if (err.code === 'failed-precondition') {
            description = "La base de datos requiere una configuración (índice) para esta operación. Revisa la consola del navegador para ver el enlace y crearlo.";
        }
        
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: groupRef.path,
            operation: 'update',
            requestResourceData: { voters: updatedVoters },
        }));

        toast({
            variant: "destructive",
            title: "Error al actualizar",
            description: description,
        });
        // Optionally revert the switch in the UI
    }
  };


  if (isLoading || isUserLoading) {
    return <GroupDetailsLoading />;
  }

  if (error || !group) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error al cargar el grupo</CardTitle>
          <CardDescription>
            No se pudo cargar el grupo. Es posible que no exista o no tengas permiso para verlo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/admin/groups">Volver a Grupos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className='flex items-center justify-between'>
        <h1 className="text-2xl font-bold font-headline">Detalles del Grupo</h1>
        <Button asChild variant="outline">
          <Link href="/admin/groups">Volver a Grupos</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{group.name}</CardTitle>
          <CardDescription>
            Este grupo tiene {(group.voters || []).length} votantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID de Votante</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(group.voters || []).map((voter) => (
                <TableRow key={voter.id}>
                  <TableCell className="font-mono text-xs">{voter.id}</TableCell>
                  <TableCell>{voter.nombre}</TableCell>
                  <TableCell>{voter.apellido}</TableCell>
                  <TableCell className="text-right">
                    <Switch
                        checked={voter.enabled !== false}
                        onCheckedChange={(checked) => handleVoterStatusChange(voter.id, checked)}
                        aria-label={`Estado del votante ${voter.nombre}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
               {(group.voters || []).length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No hay votantes en este grupo.
                    </TableCell>
                </TableRow>
               )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
