'use client';

import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { VoterGroup } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateGroupDialog } from '@/components/admin/CreateGroupDialog';
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


function GroupCard({ group }: { group: VoterGroup }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate">{group.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium">{(group.voters || []).length} Votantes</p>
        <p className="text-sm text-muted-foreground">
          Creado: {group.createdAt ? format(group.createdAt.toDate(), "d MMM yyyy", { locale: es }) : 'N/A'}
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/admin/groups/${group.id}`}>Ver Detalles</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function GroupsList() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<VoterGroup | null>(null);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'admins', user.uid, 'groups'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);

  const { data: groups, isLoading } = useCollection<VoterGroup>(groupsQuery);

  const handleDeleteClick = (group: VoterGroup) => {
    setGroupToDelete(group);
    setIsAlertOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!groupToDelete || !firestore || !user) return;
    
    const groupRef = doc(firestore, 'admins', user.uid, 'groups', groupToDelete.id);

    try {
        await deleteDoc(groupRef);
        toast({
            title: "Grupo Eliminado",
            description: `El grupo "${groupToDelete.name}" ha sido eliminado.`,
        });
    } catch(error: any) {
        const permissionError = new FirestorePermissionError({
            path: groupRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsAlertOpen(false);
        setGroupToDelete(null);
    }
  };


  if (isLoading) {
    return (
      <>
        <div className="md:hidden space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-28" /></CardContent>
              <CardFooter><Skeleton className="h-9 w-full" /></CardFooter>
            </Card>
          ))}
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Nº de Votantes</TableHead><TableHead>Creado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="h-24 text-center flex flex-col justify-center items-center">
        <p>No has creado ningún grupo todavía.</p>
        <p className="text-muted-foreground text-sm">¡Empieza creando uno!</p>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden space-y-4">
        {groups.map((group) => <GroupCard key={group.id} group={group} />)}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Nº de Votantes</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium max-w-sm truncate">{group.name}</TableCell>
                <TableCell>{(group.voters || []).length} Votantes</TableCell>
                <TableCell>{group.createdAt ? format(group.createdAt.toDate(), "d MMM, yyyy", { locale: es }) : 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/groups/${group.id}`}>Ver detalles</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteClick(group)}
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
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará permanentemente el grupo
                    <span className="font-semibold"> {groupToDelete?.name}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })}>
                    Eliminar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default function GroupsPage() {
  return (
    <div className="space-y-6">
        <CardHeader className="p-0">
            <CardTitle className="text-3xl font-bold tracking-tight font-headline">Grupos de Votantes</CardTitle>
            <CardDescription>Crea y administra listas de votantes reutilizables para tus encuestas.</CardDescription>
        </CardHeader>
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <CardTitle>Tus Grupos</CardTitle>
                <CreateGroupDialog />
                </div>
            </CardHeader>
            <CardContent>
                <GroupsList />
            </CardContent>
        </Card>
    </div>
  );
}
