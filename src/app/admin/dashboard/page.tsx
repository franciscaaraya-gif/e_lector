'use client';

import { useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal, PlusCircle } from 'lucide-react';

import { useFirestore, useCollection } from '@/firebase';
import { Poll } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';


const statusVariant: { [key: string]: 'default' | 'secondary' | 'outline' } = {
  active: 'default',
  closed: 'secondary',
  draft: 'outline',
};

const statusText: { [key: string]: string } = {
  active: 'Activa',
  closed: 'Cerrada',
  draft: 'Borrador',
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

function PollsList() {
  const firestore = useFirestore();
  const pollsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'polls'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: polls, loading } = useCollection<Poll>(pollsQuery);

  if (loading) {
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
    return (
      <div className="h-24 text-center flex flex-col justify-center items-center">
        <p>No has creado ninguna encuesta todavía.</p>
        <p className="text-muted-foreground text-sm">¡Empieza creando una!</p>
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
                      <DropdownMenuItem disabled>Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" disabled>Eliminar</DropdownMenuItem>
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

export default function DashboardPage() {
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
            <Button className="w-full sm:w-auto" disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear Encuesta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <PollsList />
        </CardContent>
      </Card>
    </div>
  );
}
