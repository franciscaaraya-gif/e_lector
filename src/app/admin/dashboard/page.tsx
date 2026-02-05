'use client';

import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal, Users, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { Poll, VoterGroup } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { CreatePollDialog } from '@/components/admin/CreatePollDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


const statusVariant: { [key: string]: 'default' | 'secondary' } = {
  active: 'default',
  closed: 'secondary',
};

const statusText: { [key: string]: string } = {
  active: 'Activa',
  closed: 'Cerrada',
};

function PollCard({ poll }: { poll: Poll }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate">{poll.question}</CardTitle>
        <Badge variant={statusVariant[poll.status] || 'secondary'} className="w-fit">{statusText[poll.status] || poll.status}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Creado: {poll.createdAt ? format(poll.createdAt.toDate(), "d MMM yyyy", { locale: es }) : 'N/A'}
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/admin/polls/${poll.id}`}>Ver Detalles</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function PollsList({ 
  polls, 
  isLoading,
  groups,
  onDeleteClick 
}: { 
  polls: Poll[] | null, 
  isLoading: boolean,
  groups: VoterGroup[] | null,
  onDeleteClick: (poll: Poll) => void 
}) {

  if (isLoading) {
    // Muestra el esqueleto de carga mientras se obtienen los datos
    // Coincide con el `loading.tsx` para una transición suave.
    return (
      <>
        <div className="md:hidden space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-5 w-20 mt-2 rounded-full" /></CardContent>
              <CardFooter><Skeleton className="h-9 w-full" /></CardFooter>
            </Card>
          ))}
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader><TableRow><TableHead>Pregunta</TableHead><TableHead>Estado</TableHead><TableHead>Creado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-10 w-10" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }
  
  if (!polls || polls.length === 0) {
    const noGroups = !groups || groups.length === 0;
    return (
      <div className="h-40 text-center flex flex-col justify-center items-center space-y-3 border-2 border-dashed rounded-lg">
        <h3 className="text-lg font-semibold">{noGroups ? "Primero crea un grupo" : "Aún no tienes encuestas"}</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          {noGroups
            ? "Para crear una encuesta, primero necesitas organizar a tus participantes en grupos de votantes."
            : "¡Es hora de crear tu primera encuesta para que tus grupos puedan votar!"
          }
        </p>
        {noGroups && (
            <Button asChild>
                <Link href="/admin/groups">
                    <Users className="mr-2 h-4 w-4" />
                    Ir a Grupos
                </Link>
            </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden space-y-4">
        {polls.map((poll) => <PollCard key={poll.id} poll={poll} />)}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pregunta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {polls.map((poll) => (
              <TableRow key={poll.id}>
                <TableCell className="font-medium max-w-sm truncate">{poll.question}</TableCell>
                <TableCell><Badge variant={statusVariant[poll.status] || 'secondary'}>{statusText[poll.status] || poll.status}</Badge></TableCell>
                <TableCell>{poll.createdAt ? format(poll.createdAt.toDate(), "d MMM, yyyy", { locale: es }) : 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link href={`/admin/polls/${poll.id}`}>Ver detalles</Link></DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDeleteClick(poll)}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}


function DashboardContents({ 
    onDeleteClick 
}: { 
    onDeleteClick: (poll: Poll) => void 
}) {
    const firestore = useFirestore();
    const { user } = useUser();

    const pollsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'admins', user.uid, 'polls'), orderBy('createdAt', 'desc'));
    }, [firestore, user]);

    const groupsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'admins', user.uid, 'groups'));
    }, [firestore, user]);

    const { data: polls, isLoading: pollsLoading } = useCollection<Poll>(pollsQuery);
    const { data: groups, isLoading: groupsLoading } = useCollection<VoterGroup>(groupsQuery);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <CardTitle>Tus Encuestas</CardTitle>
                    <CreatePollDialog />
                </div>
            </CardHeader>
            <CardContent>
                <PollsList
                    polls={polls}
                    isLoading={pollsLoading || groupsLoading}
                    groups={groups}
                    onDeleteClick={onDeleteClick}
                />
            </CardContent>
        </Card>
    );
}


export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (poll: Poll) => {
    setPollToDelete(poll);
    setIsAlertOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pollToDelete || !firestore || !user) return;
    
    setIsDeleting(true);

    const pollRef = doc(firestore, 'admins', user.uid, 'polls', pollToDelete.id);
    const lookupRef = doc(firestore, 'poll-lookup', pollToDelete.id);

    try {
        const batch = writeBatch(firestore);
        batch.delete(pollRef);
        batch.delete(lookupRef);
        await batch.commit();

        toast({
            title: "Encuesta Eliminada",
            description: `La encuesta "${pollToDelete.question}" ha sido eliminada.`,
        });
    } catch(error: any) {
        const permissionError = new FirestorePermissionError({
            path: pollRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
             variant: "destructive",
             title: "Error al eliminar",
             description: "No se pudo eliminar la encuesta. Es posible que no tengas permisos."
        })
    } finally {
        setIsDeleting(false);
        setIsAlertOpen(false);
        setPollToDelete(null);
    }
  };


  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold tracking-tight font-headline">Encuestas</CardTitle>
        <CardDescription>Crea y administra tus encuestas de votación anónima.</CardDescription>
      </CardHeader>
      
      <DashboardContents onDeleteClick={handleDeleteClick} />

       <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás realmente seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará permanentemente la encuesta
                    <span className="font-semibold"> {pollToDelete?.question}</span> y todos sus datos asociados.
                    Los votos no podrán ser recuperados.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteConfirm} 
                  className={buttonVariants({ variant: "destructive" })}
                  disabled={isDeleting}
                >
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Eliminar Permanentemente
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
