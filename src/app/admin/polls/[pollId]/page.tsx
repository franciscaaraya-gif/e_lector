'use client';

import { useParams } from 'next/navigation';
import { useUserHook, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, updateDoc, getDoc } from 'firebase/firestore';
import { Poll, VoterGroup, VoterInfo, VoterStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Copy, Users, Link as LinkIcon, QrCode } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import PollDetailsLoading from './loading';
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
import {
  Dialog,
  DialogContent,
  DialogHeader as QrDialogHeader,
  DialogTitle as QrDialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { PollResultsDialog } from '@/components/admin/PollResultsDialog';

const statusVariant: { [key: string]: 'default' | 'secondary' } = {
  active: 'default',
  closed: 'secondary',
};

const statusText: { [key: string]: string } = {
  active: 'Activa',
  closed: 'Cerrada',
};

type MergedVoter = VoterInfo & { hasVoted: boolean };

function VoterList({ poll, group, votersStatus }: { poll: Poll, group: VoterGroup, votersStatus: VoterStatus[] }) {
    const [mergedVoters, setMergedVoters] = useState<MergedVoter[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        if (group?.voters && votersStatus) {
            const voterStatusMap = new Map(votersStatus.map(v => [v.voterId, v.hasVoted]));
            const merged = group.voters.map(voterInfo => ({
                ...voterInfo,
                hasVoted: voterStatusMap.get(voterInfo.id) ?? false,
            }));
            setMergedVoters(merged);
        }
    }, [group, votersStatus]);

    const copyLink = (voterId: string) => {
        const link = `${window.location.origin}/vote/${poll.id}?voterId=${voterId}`;
        navigator.clipboard.writeText(link);
        toast({
            title: 'Enlace copiado',
            description: 'El enlace de votación personalizado ha sido copiado al portapapeles.',
        });
    };

    if (!group || !votersStatus) {
      return (
          <Card>
              <CardHeader><CardTitle>Cargando votantes...</CardTitle></CardHeader>
              <CardContent><div className="h-24 w-full bg-muted animate-pulse rounded-md" /></CardContent>
          </Card>
      );
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users />Registro de Votantes</CardTitle>
          <CardDescription>
            Una lista de votantes elegibles para esta encuesta y su estado de votación.
            Copia el enlace y envíalo a cada votante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>ID de Votante</TableHead>
                  <TableHead>Ha Votado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergedVoters.map((voter) => (
                  <TableRow key={voter.id}>
                    <TableCell className="font-medium">{voter.nombre} {voter.apellido}</TableCell>
                    <TableCell className="font-mono text-xs">{voter.id}</TableCell>
                    <TableCell>
                      {voter.hasVoted ? (
                        <Badge variant="secondary" className='bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800'>
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Sí
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <XCircle className="mr-1 h-3 w-3" />
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => copyLink(voter.id)}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar enlace
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden space-y-4">
              {mergedVoters.map((voter) => (
                  <Card key={voter.id}>
                      <CardHeader className='pb-4'>
                          <CardTitle className='text-base'>{voter.nombre} {voter.apellido}</CardTitle>
                          <CardDescription className="font-mono text-xs pt-1">{voter.id}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex justify-between items-center">
                         {voter.hasVoted ? (
                            <Badge variant="secondary" className='bg-green-100 text-green-800 border-green-200'>
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Votó
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <XCircle className="mr-1 h-3 w-3" />
                              No ha votado
                            </Badge>
                          )}
                           <Button variant="default" size="sm" onClick={() => copyLink(voter.id)}>
                            <Copy className="mr-2 h-4 w-4" /> Copiar
                          </Button>
                      </CardContent>
                  </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    );
}

export default function PollDetailsPage() {
  const { pollId } = useParams() as { pollId: string };
  const { user, isUserLoading } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pollUrl, setPollUrl] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [isConfirmAlertOpen, setConfirmAlertOpen] = useState(false);
  const [isQrModalOpen, setQrModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPollUrl(`${window.location.origin}/vote/${pollId}`);
    }
  }, [pollId]);
  
  const pollRef = useMemoFirebase(() => {
    if (!firestore || !user || !pollId) return null;
    return doc(firestore, 'admins', user.uid, 'polls', pollId);
  }, [firestore, user, pollId]);
  
  const { data: poll, isLoading: pollLoading, error: pollError } = useDoc<Poll>(pollRef);

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !user || !poll?.groupId) return null;
    return doc(firestore, 'admins', user.uid, 'groups', poll.groupId);
  }, [firestore, user, poll]);
  
  const { data: group, isLoading: groupLoading, error: groupError } = useDoc<VoterGroup>(groupRef);

  const votersStatusRef = useMemoFirebase(() => {
    if (!firestore || !user || !pollId) return null;
    return collection(firestore, 'admins', user.uid, 'polls', pollId, 'voters');
  }, [firestore, user, pollId]);

  const { data: votersStatus, isLoading: votersStatusLoading, error: votersStatusError } = useCollection<VoterStatus>(votersStatusRef);

  const copyPollUrl = () => {
    navigator.clipboard.writeText(pollUrl);
    toast({ title: 'Enlace de la encuesta copiado!' });
  };
  
  const handleStatusChangeConfirm = async () => {
    if (!poll || !firestore || !user) return;
    
    const newStatus = 'closed';
    const pollRef = doc(firestore, 'admins', user.uid, 'polls', poll.id);

    try {
        await updateDoc(pollRef, { status: newStatus });
        toast({
            title: "Estado Actualizado",
            description: `La encuesta ahora está cerrada.`,
        });
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: pollRef.path,
            operation: 'update',
            requestResourceData: { status: newStatus }
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setConfirmAlertOpen(false);
    }
  }

  if (isUserLoading || pollLoading || groupLoading || votersStatusLoading) {
    return <PollDetailsLoading />;
  }

  if (pollError || groupError || votersStatusError || !poll) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Error al cargar la encuesta</CardTitle>
                <CardDescription>
                    No se pudo cargar la encuesta. Es posible que no exista o no tengas permiso para verla.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/admin/dashboard">Volver al panel</Link>
                </Button>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
        <div className='flex items-center justify-between'>
            <h1 className="text-2xl font-bold font-headline">Detalles de la Encuesta</h1>
            <Button asChild variant="outline">
                <Link href="/admin/dashboard">Volver al Panel</Link>
            </Button>
        </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl mb-2">{poll.question}</CardTitle>
              <CardDescription>Grupo de Votantes: {group?.name || 'Cargando...'} ({(group?.voters || []).length} votantes)</CardDescription>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
                {poll.status === 'active' && (
                    <Button onClick={() => setConfirmAlertOpen(true)} variant="destructive">Cerrar Encuesta</Button>
                )}
                <Badge variant={statusVariant[poll.status] || 'secondary'} className="capitalize">
                    {statusText[poll.status] || poll.status}
                </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
                <h3 className="font-semibold mb-2">Opciones</h3>
                <ul className="list-disc list-inside space-y-1 pl-5">
                    {poll.options.map(option => <li key={option.id}>{option.text}</li>)}
                </ul>
                 {poll.pollType === 'multiple' && (
                    <p className="text-sm text-muted-foreground mt-4">
                        Selección múltiple: hasta {poll.maxSelections} opciones.
                    </p>
                )}
            </div>
            <div className='flex flex-col sm:flex-row gap-4 items-center sm:justify-end'>
                <Dialog open={isQrModalOpen} onOpenChange={setQrModalOpen}>
                  <DialogTrigger asChild>
                    <button className='text-center border-2 border-transparent hover:border-primary rounded-lg p-1 transition-colors'>
                        {pollUrl && (
                            <Image 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(pollUrl)}`}
                                alt="QR Code para la encuesta"
                                width={128}
                                height={128}
                                className='rounded-md'
                            />
                        )}
                        <p className='text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1'><QrCode className="h-3 w-3"/> Ampliar QR</p>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                        <QrDialogHeader>
                            <QrDialogTitle>Escanear para votar</QrDialogTitle>
                        </QrDialogHeader>
                        <div className="flex flex-col items-center justify-center p-4">
                             {pollUrl && (
                                <Image 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pollUrl)}`}
                                    alt="QR Code para la encuesta"
                                    width={300}
                                    height={300}
                                    className='rounded-lg border p-2'
                                />
                            )}
                            <p className="text-sm text-muted-foreground mt-4 break-all">{pollUrl}</p>
                        </div>
                  </DialogContent>
                </Dialog>
                <div className='flex flex-col gap-2 w-full sm:w-auto'>
                    <Button onClick={copyPollUrl} className="w-full">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Copiar Enlace General
                    </Button>
                    <Button onClick={() => setShowResults(true)} variant="secondary" disabled={poll.status !== 'closed'} className="w-full">
                        Ver Resultados
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>
      
      {group && votersStatus && <VoterList poll={poll} group={group} votersStatus={votersStatus} />}
      
      {poll && <PollResultsDialog poll={poll} open={showResults} onOpenChange={setShowResults} />}

      <AlertDialog open={isConfirmAlertOpen} onOpenChange={setConfirmAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Confirmar acción?</AlertDialogTitle>
                <AlertDialogDescription>
                    Al cerrar la encuesta, se detendrá la votación y podrás ver los resultados. ¿Deseas continuar?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleStatusChangeConfirm}>
                    Confirmar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
