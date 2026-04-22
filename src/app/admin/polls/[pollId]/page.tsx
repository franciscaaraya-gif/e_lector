'use client';

import { useParams } from 'next/navigation';
import { useUser, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, updateDoc, writeBatch, getDocs, serverTimestamp } from 'firebase/firestore';
import { Poll, VoterGroup, VoterInfo, VoterStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Copy, Users, Link as LinkIcon, Loader2, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useMemo } from 'react';
import PollDetailsLoading from './loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

const statusVariant: { [key: string]: 'default' | 'secondary' | 'outline' } = {
  pending: 'outline',
  active: 'default',
  closed: 'secondary',
};

const statusText: { [key: string]: string } = {
  pending: 'Pendiente',
  active: 'Activa',
  closed: 'Cerrada',
};

type MergedVoter = VoterInfo & { hasVoted: boolean; statusDocId: string; enabled: boolean };

function VoterList({ poll, group, votersStatus }: { poll: Poll, group: VoterGroup, votersStatus: VoterStatus[] }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [mergedVoters, setMergedVoters] = useState<MergedVoter[]>([]);

    useEffect(() => {
        if (group?.voters && votersStatus) {
            const voterStatusMap = new Map(votersStatus.map(v => [v.voterId, { hasVoted: v.hasVoted, docId: v.id, enabled: v.enabled !== false }]));
            const merged = group.voters.map(voterInfo => {
                const status = voterStatusMap.get(voterInfo.id);
                return {
                    ...voterInfo,
                    hasVoted: status?.hasVoted ?? false,
                    statusDocId: status?.docId ?? '',
                    enabled: status?.enabled ?? true,
                };
            });
            setMergedVoters(merged);
        }
    }, [group, votersStatus]);

    const stats = useMemo(() => {
        const total = mergedVoters.length;
        const enabled = mergedVoters.filter(v => v.enabled).length;
        const disabled = total - enabled;
        return { total, enabled, disabled };
    }, [mergedVoters]);

    const copyLink = (voterId: string) => {
        const link = `${window.location.origin}/vote/${poll.id}?voterId=${voterId}`;
        navigator.clipboard.writeText(link);
        toast({ title: 'Enlace copiado' });
    };

    const toggleVoterEnabled = async (statusDocId: string, currentEnabled: boolean) => {
        if (!firestore || !user || !statusDocId) return;

        const voterStatusRef = doc(firestore, 'admins', user.uid, 'polls', poll.id, 'voters', statusDocId);
        
        try {
            await updateDoc(voterStatusRef, { enabled: !currentEnabled });
            toast({ 
                title: !currentEnabled ? 'Votante Habilitado' : 'Votante Deshabilitado',
                description: !currentEnabled ? 'Ahora puede acceder a votar.' : 'Ya no podrá participar.'
            });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: voterStatusRef.path,
                operation: 'update',
                requestResourceData: { enabled: !currentEnabled }
            }));
        }
    };

    if (!group || !votersStatus || votersStatus.length === 0) return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Registro de Votantes</CardTitle>
                <CardDescription>Cargando lista de participantes...</CardDescription>
            </CardHeader>
        </Card>
    );
    
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2"><Users />Registro de Votantes</CardTitle>
                <CardDescription>
                    {poll.status === 'pending' 
                        ? 'Habilita o deshabilita votantes antes de activar la votación.' 
                        : `Votantes oficiales para "${group.name}". El acceso individual está bloqueado.`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> Total: {stats.total}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Habilitados: {stats.enabled}
                  </Badge>
                  <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
                      <UserX className="h-3 w-3" /> No Habilitados: {stats.disabled}
                  </Badge>
              </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado de Acceso</TableHead>
                  <TableHead>¿Votó?</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergedVoters.map((voter) => (
                  <TableRow key={voter.id} className={!voter.enabled ? 'opacity-60 bg-muted/30' : ''}>
                    <TableCell className="font-medium">
                        <div className='flex flex-col'>
                            <span>{voter.nombre} {voter.apellido}</span>
                            <span className='text-[10px] text-muted-foreground font-mono'>{voter.id}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center space-x-2">
                            <Switch 
                                checked={voter.enabled} 
                                onCheckedChange={() => toggleVoterEnabled(voter.statusDocId, voter.enabled)}
                                disabled={poll.status !== 'pending'}
                            />
                            <Label className='text-xs font-normal'>
                                {voter.enabled ? 'Habilitado' : 'No habilitado'}
                            </Label>
                        </div>
                    </TableCell>
                    <TableCell>
                      {voter.hasVoted ? (
                        <Badge variant="secondary" className='bg-green-100 text-green-800 border-green-200'>
                          <CheckCircle className="mr-1 h-3 w-3" /> Sí
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <XCircle className="mr-1 h-3 w-3" /> No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => copyLink(voter.id)} disabled={!voter.enabled || poll.status === 'closed'}>
                        <Copy className="mr-2 h-4 w-4" /> Enlace
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden space-y-4">
              {mergedVoters.map((voter) => (
                  <Card key={voter.id} className={!voter.enabled ? 'opacity-60' : ''}>
                      <CardHeader className='pb-4'>
                          <div className='flex justify-between items-start'>
                            <CardTitle className='text-base'>{voter.nombre} {voter.apellido}</CardTitle>
                            <Switch 
                                checked={voter.enabled} 
                                onCheckedChange={() => toggleVoterEnabled(voter.statusDocId, voter.enabled)}
                                disabled={poll.status !== 'pending'}
                            />
                          </div>
                          <CardDescription className="font-mono text-xs">{voter.id} | {voter.enabled ? 'Habilitado' : 'No habilitado'}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex justify-between items-center">
                         {voter.hasVoted ? <Badge className='bg-green-100 text-green-800'>Votó</Badge> : <Badge variant="outline">No ha votado</Badge>}
                         <Button variant="default" size="sm" onClick={() => copyLink(voter.id)} disabled={!voter.enabled || poll.status === 'closed'}>Copiar</Button>
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
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [pollUrl, setPollUrl] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [isConfirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [isQrModalOpen, setQrModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      setPollUrl(`${window.location.origin}/inbox?salaId=${user.uid}`);
    }
  }, [user]);
  
  const pollRef = useMemoFirebase(() => {
    if (!firestore || !user || !pollId) return null;
    return doc(firestore, 'admins', user.uid, 'polls', pollId);
  }, [firestore, user, pollId]);
  
  const { data: poll, isLoading: pollLoading, error: pollError } = useDoc<Poll>(pollRef);

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !user || !poll?.groupId) return null;
    return doc(firestore, 'admins', user.uid, 'groups', poll.groupId);
  }, [firestore, user, poll]);
  
  const { data: group, isLoading: groupLoading } = useDoc<VoterGroup>(groupRef);

  const votersStatusRef = useMemoFirebase(() => {
    if (!firestore || !user || !pollId) return null;
    return collection(firestore, 'admins', user.uid, 'polls', pollId, 'voters');
  }, [firestore, user, pollId]);

  const { data: votersStatus, isLoading: votersStatusLoading } = useCollection<VoterStatus>(votersStatusRef);

  const allGroupsQuery = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return collection(firestore, 'admins', user.uid, 'groups');
  }, [firestore, user]);
  const { data: allGroups, isLoading: allGroupsLoading } = useCollection<VoterGroup>(allGroupsQuery);

  useEffect(() => {
      if (poll?.groupId) {
          setSelectedGroupId(poll.groupId);
      }
  }, [poll]);

  const handleAssignGroup = async () => {
    if (!poll || !selectedGroupId || !firestore || !user || !allGroups) return;
    
    setIsAssigning(true);
    try {
        const selectedGroup = allGroups.find(g => g.id === selectedGroupId);
        if (!selectedGroup) throw new Error("Grupo no encontrado");

        const batch = writeBatch(firestore);
        const pollRef = doc(firestore, 'admins', user.uid, 'polls', poll.id);
        
        // 1. Vincular el grupo a la votación
        batch.update(pollRef, { groupId: selectedGroupId });

        // 2. Limpiar votantes previos si existieran (en caso de re-asignación)
        const votersCollRef = collection(firestore, 'admins', user.uid, 'polls', poll.id, 'voters');
        const existingVotersSnap = await getDocs(votersCollRef);
        existingVotersSnap.forEach(vdoc => batch.delete(vdoc.ref));

        // 3. Crear registros iniciales de votantes (todos habilitados por defecto)
        selectedGroup.voters.forEach(voter => {
            const vRef = doc(votersCollRef);
            batch.set(vRef, {
                voterId: voter.id,
                pollId: poll.id,
                hasVoted: false,
                adminId: user.uid,
                enabled: true
            });
        });

        await batch.commit();
        toast({ title: "Grupo Asignado", description: "Votantes vinculados correctamente. Ahora puedes habilitar/deshabilitar individualmente." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "No se pudo asignar el grupo." });
    } finally {
        setIsAssigning(false);
    }
  };

  const handleActivatePoll = async () => {
      if (!poll || !poll.groupId || !firestore || !user) return;
      
      setIsActivating(true);
      try {
          const pollRef = doc(firestore, 'admins', user.uid, 'polls', poll.id);
          await updateDoc(pollRef, { 
              status: 'active',
              activatedAt: serverTimestamp() // Registramos hora de inicio
          });
          toast({ title: "Votación Activada", description: "La votación ya es pública para los votantes habilitados." });
      } catch (error) {
          toast({ variant: 'destructive', title: "Error al activar", description: "No se pudo activar la votación." });
      } finally {
          setIsActivating(false);
      }
  };

  const handleClosePoll = async () => {
    if (!poll || !firestore || !user) return;
    const pollRef = doc(firestore, 'admins', user.uid, 'polls', poll.id);
    try {
        await updateDoc(pollRef, { 
            status: 'closed',
            closedAt: serverTimestamp() // Registramos hora de término
        });
        toast({ title: "Votación Cerrada" });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error" });
    } finally {
        setConfirmCloseOpen(false);
    }
  }

  if (isUserLoading || pollLoading || groupLoading || votersStatusLoading || allGroupsLoading) {
    return <PollDetailsLoading />;
  }

  if (pollError || !poll) {
    return <Card className="m-6"><CardHeader><CardTitle>Votación no encontrada</CardTitle></CardHeader></Card>;
  }

  return (
    <div className="space-y-6">
        <div className='flex items-center justify-between'>
            <h1 className="text-2xl font-bold font-headline">Gestión de Votación</h1>
            <Button asChild variant="outline"><Link href="/admin/dashboard">Volver</Link></Button>
        </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className='flex-1'>
              <CardTitle className="text-2xl mb-2">{poll.question}</CardTitle>
              <CardDescription>
                {poll.status === 'pending' 
                    ? (!poll.groupId ? 'Paso 1: Asignar grupo de votantes.' : 'Paso 2: Activar votación.') 
                    : `Votación ${statusText[poll.status]}`}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
                {poll.status === 'active' && (
                    <Button onClick={() => setConfirmCloseOpen(true)} variant="destructive">Cerrar</Button>
                )}
                <Badge variant={statusVariant[poll.status]} className="capitalize">
                    {statusText[poll.status]}
                </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
                <h3 className="font-semibold mb-2">Opciones de Respuesta</h3>
                <ul className="list-disc list-inside space-y-1 pl-5 text-sm">
                    {poll.options.map(option => <li key={option.id}>{option.text}</li>)}
                </ul>
            </div>
            {poll.status !== 'pending' && (
                <div className='flex flex-col sm:flex-row gap-4 items-center sm:justify-end'>
                    <Dialog open={isQrModalOpen} onOpenChange={setQrModalOpen}>
                      <DialogTrigger asChild>
                        <button className='text-center border rounded-lg p-2 bg-white shadow-sm hover:border-primary/50 transition-colors'>
                            {pollUrl && <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(pollUrl)}`} alt="QR" width={100} height={100} />}
                            <p className='text-[10px] text-muted-foreground mt-2'>Ampliar QR</p>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md flex flex-col items-center">
                            <QrDialogTitle>QR General de Votación</QrDialogTitle>
                            {pollUrl && <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pollUrl)}`} alt="QR" width={300} height={300} className='border p-2 bg-white' />}
                      </DialogContent>
                    </Dialog>
                    <div className='flex flex-col gap-2 w-full sm:w-auto'>
                        <Button onClick={() => { navigator.clipboard.writeText(pollUrl); toast({ title: 'Copiado' }); }}>
                            <LinkIcon className="mr-2 h-4 w-4" /> Copiar Enlace
                        </Button>
                        {poll.status === 'closed' && (
                          <Button onClick={() => setShowResults(true)} variant="secondary">
                              Resultados e Informe
                          </Button>
                        )}
                    </div>
                </div>
            )}
        </CardContent>
      </Card>

      {poll.status === 'pending' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className={poll.groupId ? "opacity-70 border-muted" : "border-primary/50 bg-primary/5"}>
                  <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" /> Paso 1: Asignar Grupo
                      </CardTitle>
                      <CardDescription>
                          Vincular una lista de votantes.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <Select onValueChange={setSelectedGroupId} value={selectedGroupId} disabled={isActivating || isAssigning}>
                          <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecciona un grupo" />
                          </SelectTrigger>
                          <SelectContent>
                              {allGroups?.map(g => (
                                  <SelectItem key={g.id} value={g.id}>{g.name} ({g.voters.length} miembros)</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      <Button onClick={handleAssignGroup} disabled={!selectedGroupId || isAssigning || isActivating} className="w-full">
                          {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {poll.groupId ? 'Cambiar Grupo' : 'Asignar Grupo'}
                      </Button>
                  </CardContent>
              </Card>

              <Card className={!poll.groupId ? "opacity-50 grayscale pointer-events-none" : "border-accent/50 bg-accent/5"}>
                  <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-accent" /> Paso 2: Activar Votación
                      </CardTitle>
                      <CardDescription>
                          Habilitar acceso público.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className='text-xs text-muted-foreground p-3 border rounded-md bg-background'>
                        Al activar, solo los votantes <strong>Habilitados</strong> en la lista de abajo podrán participar.
                      </div>
                      <Button onClick={handleActivatePoll} disabled={!poll.groupId || isActivating || isAssigning} variant="default" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                          {isActivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Activar Votación Ahora
                      </Button>
                  </CardContent>
              </Card>
          </div>
      )}
      
      {poll.groupId && group && votersStatus && (
          <VoterList poll={poll} group={group} votersStatus={votersStatus} />
      )}
      
      <PollResultsDialog poll={poll} open={showResults} onOpenChange={setShowResults} />

      <AlertDialog open={isConfirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar Votación?</AlertDialogTitle>
                <AlertDialogDescription>No se recibirán más votos y los resultados serán definitivos.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClosePoll}>Cerrar Votación</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
