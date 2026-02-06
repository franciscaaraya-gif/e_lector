'use client';

import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { Poll, VoterGroup } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const statusVariant: Record<string, 'default' | 'secondary'> = {
  active: 'default',
  closed: 'secondary',
};

const statusText: Record<string, string> = {
  active: 'Activa',
  closed: 'Cerrada',
};

/* =========================
   Mobile Card
========================= */
function PollCard({
  poll,
  onDeleteClick,
}: {
  poll: Poll;
  onDeleteClick: (poll: Poll) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 space-y-2 min-w-0">
            <CardTitle className="truncate">{poll.question}</CardTitle>
            <Badge
              variant={statusVariant[poll.status] || 'secondary'}
              className="w-fit"
            >
              {statusText[poll.status] || poll.status}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/polls/${poll.id}`}>Ver detalles</Link>
              </DropdownMenuItem>
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
          Creado:{' '}
          {poll.createdAt
            ? format(poll.createdAt.toDate(), 'd MMM yyyy', { locale: es })
            : 'N/A'}
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

/* =========================
   List
========================= */
function PollsList({
  polls,
  isLoading,
  onPollDeleteClick,
}: {
  polls: Poll[] | null;
  isLoading: boolean;
  onPollDeleteClick: (poll: Poll) => void;
}) {
  if (isLoading) {
    return (
      <>
        <div className="md:hidden space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-5 w-20 mt-2 rounded-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="hidden md:block">
          <Table>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-10 w-10" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden space-y-4">
        {polls?.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            onDeleteClick={onPollDeleteClick}
          />
        ))}
      </div>

      {/* Desktop */}
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
            {polls?.map((poll) => (
              <TableRow key={poll.id}>
                <TableCell className="font-medium max-w-sm truncate">
                  {poll.question}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[poll.status] || 'secondary'}>
                    {statusText[poll.status] || poll.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {poll.createdAt
                    ? format(poll.createdAt.toDate(), 'd MMM yyyy', {
                        locale: es,
                      })
                    : 'N/A'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/polls/${poll.id}`}>
                          Ver detalles
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onPollDeleteClick(poll)}
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

/* =========================
   Page
========================= */
export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);

  const pollsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'admins', user.uid, 'polls'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: polls, isLoading } = useCollection<Poll>(pollsQuery);

  const handleDeleteConfirm = async () => {
    if (!pollToDelete || !firestore || !user) return;

    const pollRef = doc(
      firestore,
      'admins',
      user.uid,
      'polls',
      pollToDelete.id
    );
    const lookupRef = doc(firestore, 'poll-lookup', pollToDelete.id);
    const question = pollToDelete.question;

    setPollToDelete(null);

    toast({
      title: 'Eliminando encuesta...',
      description: question,
    });

    try {
      const batch = writeBatch(firestore);
      batch.delete(pollRef);
      batch.delete(lookupRef);
      await batch.commit();

      toast({
        title: 'Encuesta eliminada',
        description: question,
      });
    } catch {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: pollRef.path,
          operation: 'delete',
        })
      );
    }
  };

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold">Encuestas</CardTitle>
        <CardDescription>
          Crea y administra tus encuestas
        </CardDescription>
      </CardHeader>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Tus encuestas</CardTitle>
          <CreatePollDialog />
        </CardHeader>

        <CardContent>
          <PollsList
            polls={polls}
            isLoading={isLoading}
            onPollDeleteClick={setPollToDelete}
          />
        </CardContent>
      </Card>

      <AlertDialog open={!!pollToDelete} onOpenChange={() => setPollToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar encuesta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
              <br />
              <strong>{pollToDelete?.question}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
