'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { VoterGroup } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import GroupDetailsLoading from './loading';

export default function GroupDetailsPage() {
  const { groupId } = useParams() as { groupId: string };
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !user || !groupId) return null;
    return doc(firestore, 'admins', user.uid, 'groups', groupId);
  }, [firestore, user, groupId]);

  const { data: group, isLoading, error } = useDoc<VoterGroup>(groupRef);

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {(group.voters || []).map((voter) => (
                <TableRow key={voter.id}>
                  <TableCell className="font-mono text-xs">{voter.id}</TableCell>
                  <TableCell>{voter.nombre}</TableCell>
                  <TableCell>{voter.apellido}</TableCell>
                </TableRow>
              ))}
               {(group.voters || []).length === 0 && (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
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
