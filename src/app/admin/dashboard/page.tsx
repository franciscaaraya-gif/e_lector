'use client';

import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal, Users, PlusCircle } from 'lucide-react';
import { useState, useMemo } from 'react';

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

function PollCard({ poll, onDeleteClick }: { poll: Poll, onDeleteClick: (poll: Poll) => void }) {
  return (
    <Card>
      <CardHeader className='pb-4'>
        <div className="flex justify-between items-start gap-2">
            <div className='flex-1 space-y-2 min-w-0'>
                <CardTitle className="truncate">{poll.question}</CardTitle>
                <Badge variant={statusVariant[poll.status] || 'secondary'} className="w-fit">{statusText[poll.status] || poll.status}</Badge>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
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
        </div>
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


export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  // State for the single, global dialog. It holds the poll to be deleted.
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);

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


  const handleDeleteConfirm = async () => {
    if (!pollToDelete || !firestore || !user) return;
    
    const pollToDeleteCopy = { ...pollToDelete };

    // Close the dialog UI *before* the async operation.
    // This is the key to preventing the "zombie overlay" bug.
    setPollToDelete(null);

    toast({
        title: "Eliminando encuesta...",
        description: `Por favor, espera un momento.`,
    });

    const pollRef = doc(firestore, 'admins', user.uid, 'polls', pollToDeleteCopy.id);
    const lookupRef = doc(firestore, 'poll-lookup', pollToDeleteCopy.id);

    try {
        const batch = writeBatch(firestore);
        batch.delete(pollRef);
        batch.delete(lookupRef);
        await batch.commit();

        toast({
            title: "¡Encuesta Eliminada!",
            description: `La encuesta "${pollToDeleteCopy.question}" se eliminó correctamente.`,
        });
    } catch(error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: pollRef.path,
            operation: 'delete',
        }));
        toast({
             variant: "destructive",
             title: "Error al eliminar",
             description: "No se pudo eliminar la encuesta. Es posible que no tengas permisos."
        });
    }
  };
  
  const isLoading = pollsLoading || groupsLoading;


  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold tracking-tight font-headline">Encuestas</CardTitle>
        <CardDescription>Crea y administra tus encuestas de votación anónima.</CardDescription>
      </CardHeader>
      
      <Card>
          <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <CardTitle>Tus Encuestas</CardTitle>
                  <CreatePollDialog />
              </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <>
                    {/* Mobile Skeleton */}
                    <div className="md:hidden space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <Card key={i}>
                            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                            <CardContent><Skeleton className="h-5 w-20 mt-2 rounded-full" /></CardContent>
                            <CardFooter><Skeleton className="h-9 w-full" /></CardFooter>
                            </Card>
                        ))}
                    </div>
                    {/* Desktop Skeleton */}
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
            ) : !polls || polls.length === 0 ? (
                (() => {
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
                })()
            ) : (
                <>
                    {/* Mobile List */}
                    <div className="md:hidden space-y-4">
                        {polls.map((poll) => <PollCard key={poll.id} poll={poll} onDeleteClick={setPollToDelete} />)}
                    </div>
                    {/* Desktop Table */}
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
                                        onClick={() => setPollToDelete(poll)}
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
            )}
          </CardContent>
      </Card>

      {/* This is the single, global AlertDialog. It is controlled by `pollToDelete` state. */}
       <AlertDialog open={!!pollToDelete} onOpenChange={(open) => !open && setPollToDelete(null)}>
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
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteConfirm} 
                  className={buttonVariants({ variant: "destructive" })}
                >
                    Eliminar Permanentemente
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
