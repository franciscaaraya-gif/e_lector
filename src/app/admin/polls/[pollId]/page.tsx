'use client';

import { useParams } from 'next/navigation';
import { useUser, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, updateDoc, writeBatch, getDocs, serverTimestamp, query } from 'firebase/firestore';
import { Poll, VoterGroup, VoterInfo, VoterStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Copy, Users, Link as LinkIcon, Loader2, UserCheck, UserX, Search, Vote as VoteIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useMemo } from 'react';
import PollDetailsLoading from './loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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

type MergedVoter = {
    id: string;
    nombre: string;
    apellido: string;
    hasVoted: boolean;
    statusDocId: string;
    enabled: boolean;
};

function VoterList({ poll, votersStatus }: { poll: Poll, votersStatus: VoterStatus[] }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    
    const mergedVoters = useMemo(() => {
        if (!votersStatus) return [];
        return votersStatus.map(v => ({
            id: v.voterId,
            nombre: v.nombre || '',
            apellido: v.apellido || '',
            hasVoted: v.hasVoted,
            statusDocId: v.id,
            enabled: v.enabled !== false,
        })).sort((a, b) => {
            const apellidoA = a.apellido.toLowerCase();
            const apellidoB = b.apellido.toLowerCase();
            if (apellidoA < apellidoB) return -1;
            if (apellidoA > apellidoB) return 1;
            return a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase());
        });
    }, [votersStatus]);

    const stats = useMemo(() => {
        const total = mergedVoters.length;
        const enabled = mergedVoters.filter(v => v.enabled).length;
        const disabled = total - enabled;
        const voted = mergedVoters.filter(v => v.enabled && v.hasVoted).length;
        const pending = enabled - voted;
        return { total, enabled, disabled, voted, pending };
    }, [mergedVoters]);

    const filteredVoters = useMemo(() => {
        let list = mergedVoters;
        
        // Durante la votación activa, solo mostramos los que faltan por votar
        if (poll.status === 'active') {
            list = list.filter(v => v.enabled && !v.hasVoted);
        }

        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase();
            list = list.filter(v => 
                `${v.apellido} ${v.nombre}`.toLowerCase().includes(search)
            );
        }
        
        return list;
    }, [mergedVoters, poll.status, searchTerm]);

    const copyVoterLink = (voterId: string) => {
        if (!user) return;
        const link = `${window.location.origin}/inbox?salaId=${user.uid}&voterId=${voterId}`;
        navigator.clipboard.writeText(link);
        toast({ title: 'Enlace copiado', description: 'El enlace con registro pre-llenado está en el portapapeles.' });
    };

    const toggleVoterEnabled = async (statusDocId: string, currentEnabled: boolean) => {
        if (!firestore || !user || !statusDocId) return;
        const voterStatusRef = doc(firestore, 'admins', user.uid, 'polls', poll.id, 'voters', statusDocId);
        try {
            await updateDoc(voterStatusRef, { enabled: !currentEnabled });
            toast({ title: !currentEnabled ? 'Habilitado' : 'Deshabilitado' });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: voterStatusRef.path,
                operation: 'update',
            }));
        }
    };

    const chartData = [
        { name: 'Votaron', value: stats.voted, color: 'hsl(var(--primary))' },
        { name: 'Pendientes', value: stats.pending, color: 'hsl(var(--muted-foreground)/0.2)' }
    ];

    if (!votersStatus || (poll.status === 'pending' && !poll.groupId)) return null;

    return (
      <div className="space-y-6">
        {(poll.status === 'active' || poll.status === 'closed') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Participación Real</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="text-center mt-2">
                            <p className="text-3xl font-bold">{stats.enabled > 0 ? Math.round((stats.voted / stats.enabled) * 100) : 0}%</p>
                            <p className="text-xs text-muted-foreground">Quórum Alcanzado</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Estadísticas de Sala</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase font-bold">En Sala</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-green-600 uppercase font-bold">Con Derecho</p>
                            <p className="text-2xl font-bold text-green-700">{stats.enabled}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-red-600 uppercase font-bold">No Habilitados</p>
                            <p className="text-2xl font-bold text-red-700">{stats.disabled}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-primary uppercase font-bold">Votaron</p>
                            <p className="text-2xl font-bold text-primary">{stats.voted}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* Solo mostramos la tabla si NO está cerrada */}
        {poll.status !== 'closed' && (
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" /> 
                                {poll.status === 'active' ? 'Voluntarios Pendientes por Votar' : 'Registro de Votantes'}
                            </CardTitle>
                            <CardDescription>
                                {poll.status === 'active' 
                                    ? 'Listado de personas habilitadas que aún no han emitido su voto.' 
                                    : 'Gestión de acceso para el grupo asignado.'}
                            </CardDescription>
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Nombre Completo (Apellido Apellido Nombres)</TableHead>
                                    {poll.status === 'pending' && <TableHead>Habilitación</TableHead>}
                                    {poll.status !== 'active' && <TableHead>¿Votó?</TableHead>}
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVoters.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                                            {searchTerm ? 'No se encontraron coincidencias.' : (poll.status === 'active' ? '¡Todos los habilitados han votado!' : 'No hay votantes en esta lista.')}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredVoters.map((voter) => (
                                        <TableRow key={voter.id} className={!voter.enabled ? 'opacity-60 bg-muted/30' : ''}>
                                            <TableCell className="font-medium">
                                                <span className="uppercase font-bold">{voter.apellido}</span> {voter.nombre}
                                            </TableCell>
                                            {poll.status === 'pending' && (
                                                <TableCell>
                                                    <div className="flex items-center space-x-2">
                                                        <Switch 
                                                            checked={voter.enabled} 
                                                            onCheckedChange={() => toggleVoterEnabled(voter.statusDocId, voter.enabled)}
                                                        />
                                                        <Label className="text-xs font-normal">{voter.enabled ? 'Habilitado' : 'Bloqueado'}</Label>
                                                    </div>
                                                </TableCell>
                                            )}
                                            {poll.status !== 'active' && (
                                                <TableCell>
                                                    {voter.hasVoted ? (
                                                        <Badge variant="secondary" className="bg-green-100 text-green-800">SÍ</Badge>
                                                    ) : (
                                                        <Badge variant="outline">NO</Badge>
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => copyVoterLink(voter.id)}
                                                    disabled={poll.status === 'closed'}
                                                >
                                                    <Copy className="mr-2 h-4 w-4" /> Enlace
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        )}
      </div>
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

  const votersStatusRef = useMemoFirebase(() => {
    if (!firestore || !user || !pollId) return null;
    return collection(firestore, 'admins', user.uid, 'polls', pollId, 'voters');
  }, [firestore, user, pollId]);

  const { data: votersStatus, isLoading: votersStatusLoading } = useCollection<VoterStatus>(votersStatusRef);

  // OPTIMIZACIÓN: Solo descargar todos los grupos si la encuesta está en estado 'pending'
  const allGroupsQuery = useMemoFirebase(() => {
      if (!firestore || !user || poll?.status !== 'pending') return null;
      return collection(firestore, 'admins', user.uid, 'groups');
  }, [firestore, user, poll?.status]);
  
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
        
        batch.update(pollRef, { groupId: selectedGroupId });

        const votersCollRef = collection(firestore, 'admins', user.uid, 'polls', poll.id, 'voters');
        const existingVotersSnap = await getDocs(votersCollRef);
        existingVotersSnap.forEach(vdoc => batch.delete(vdoc.ref));

        selectedGroup.voters.forEach(voter => {
            const vRef = doc(votersCollRef);
            batch.set(vRef, {
                voterId: voter.id,
                pollId: poll.id,
                hasVoted: false,
                adminId: user.uid,
                enabled: true,
                nombre: voter.nombre || '',
                apellido: voter.apellido || ''
            });
        });

        await batch.commit();
        toast({ title: "Grupo Asignado" });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error" });
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
              activatedAt: serverTimestamp() 
          });
          toast({ title: "Votación Activada" });
      } catch (error) {
          toast({ variant: 'destructive', title: "Error al activar" });
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
            closedAt: serverTimestamp() 
        });
        toast({ title: "Votación Cerrada" });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error" });
    } finally {
        setConfirmCloseOpen(false);
    }
  }

  if (isUserLoading || pollLoading || votersStatusLoading || (allGroupsLoading && poll?.status === 'pending')) {
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
                            <LinkIcon className="mr-2 h-4 w-4" /> Copiar Enlace General
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
                      <CardDescription>Vincular una lista de votantes.</CardDescription>
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
                      <CardDescription>Habilitar acceso público.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className='text-xs text-muted-foreground p-3 border rounded-md bg-background'>
                        Solo los votantes <strong>Habilitados</strong> podrán participar.
                      </div>
                      <Button onClick={handleActivatePoll} disabled={!poll.groupId || isActivating || isAssigning} variant="default" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                          {isActivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Activar Votación Ahora
                      </Button>
                  </CardContent>
              </Card>
          </div>
      )}
      
      {votersStatus && (
          <VoterList poll={poll} votersStatus={votersStatus} />
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