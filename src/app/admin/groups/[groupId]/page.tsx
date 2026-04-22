'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Fingerprint, 
  Search, 
  UserPlus, 
  Trash2, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Users,
  Save,
  Check
} from 'lucide-react';

import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { VoterGroup, ListaCompletaItem, VoterInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import GroupDetailsLoading from './loading';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function GroupDetailsPage() {
  const { groupId } = useParams() as { groupId: string };
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [searchId, setSearchId] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualNames, setManualNames] = useState('');
  const [manualLastNames, setManualLastNames] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Get current group data
  const groupRef = useMemoFirebase(() => {
    if (!firestore || !user || !groupId) return null;
    return doc(firestore, 'admins', user.uid, 'groups', groupId);
  }, [firestore, user, groupId]);

  const { data: group, isLoading: isGroupLoading } = useDoc<VoterGroup>(groupRef);

  // Load personnel list for lookup
  const personalQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'admins', user.uid, 'lista_completa');
  }, [firestore, user]);

  const { data: personnel } = useCollection<ListaCompletaItem>(personalQuery);

  // Search logic for UI preview (multi-match)
  const searchResults = useMemo(() => {
    if (!searchId.trim() || !personnel || searchId.trim().length < 2) return [];
    const search = searchId.trim().toLowerCase();
    
    return personnel.filter(p => 
      (p.regGeneral && String(p.regGeneral).toLowerCase().includes(search)) || 
      p.id.toLowerCase().includes(search) ||
      `${p.nombres} ${p.apellidos}`.toLowerCase().includes(search)
    ).slice(0, 5); // Limit to 5 results for the picker
  }, [searchId, personnel]);

  const addVoterToGroup = async (voter: VoterInfo) => {
    if (!group || !groupRef) return;

    if (group.voters.some(v => v.id === voter.id)) {
      toast({ variant: 'destructive', title: 'Ya existe', description: 'Esta persona ya está en el grupo.' });
      setSearchId('');
      return;
    }

    const updatedVoters = [...group.voters, voter];
    setIsUpdating(true);

    try {
      await updateDoc(groupRef, { voters: updatedVoters });
      toast({ title: 'Votante Agregado', description: `${voter.nombre} ha sido añadido al grupo.` });
      setSearchId('');
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: groupRef.path,
        operation: 'update',
        requestResourceData: { voters: updatedVoters }
      }));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim().toLowerCase();
      if (!value || !personnel) return;

      // Try exact ID match first
      const exactMatch = personnel.find(p => 
        (p.regGeneral && String(p.regGeneral).toLowerCase() === value) || 
        p.id.toLowerCase() === value
      );

      if (exactMatch) {
        addVoterToGroup({
          id: exactMatch.regGeneral || exactMatch.id,
          nombre: exactMatch.nombres,
          apellido: exactMatch.apellidos,
          enabled: true
        });
      } else if (searchResults.length === 1) {
        // If there's only one search result (by name or partial ID), add it on Enter
        const found = searchResults[0];
        addVoterToGroup({
          id: found.regGeneral || found.id,
          nombre: found.nombres,
          apellido: found.apellidos,
          enabled: true
        });
      }
    }
  };

  const removeVoterFromGroup = async (voterId: string) => {
    if (!group || !groupRef) return;

    const updatedVoters = group.voters.filter(v => v.id !== voterId);
    setIsUpdating(true);

    try {
      await updateDoc(groupRef, { voters: updatedVoters });
      toast({ title: 'Votante Eliminado', description: 'La persona ha sido retirada del grupo.' });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: groupRef.path,
        operation: 'update',
        requestResourceData: { voters: updatedVoters }
      }));
    } finally {
      setIsUpdating(false);
    }
  };

  const addManualVoter = () => {
    if (!manualNames.trim() || !manualLastNames.trim()) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Por favor ingresa nombre y apellido.' });
      return;
    }

    const randomDigits = Math.floor(10000 + Math.random() * 90000).toString();
    const newId = `EXT-${randomDigits}`;

    addVoterToGroup({
      id: newId,
      nombre: manualNames.trim(),
      apellido: manualLastNames.trim(),
      enabled: true
    });
    
    setManualNames('');
    setManualLastNames('');
    setShowManualForm(false);
  };

  if (isUserLoading || isGroupLoading) {
    return <GroupDetailsLoading />;
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-xl font-bold">Grupo no encontrado</h2>
        <Button asChild><Link href="/admin/groups">Volver a Grupos</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className='flex items-center justify-between'>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/groups"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-2xl font-bold font-headline">Enrolamiento: {group.name}</h1>
        </div>
        {isUpdating && (
          <div className="flex items-center text-sm text-muted-foreground animate-pulse">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando cambios...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Buscar Miembros
              </CardTitle>
              <CardDescription>Busca por nombre o escanea la tarjeta de identificación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input 
                  placeholder="Nombre o ID de registro..." 
                  className="bg-primary/5 focus:bg-background transition-colors"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
              </div>
              
              {searchResults.length > 0 && (
                <div className="border rounded-md divide-y overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                   <ScrollArea className={searchResults.length > 3 ? "h-64" : "h-auto"}>
                    {searchResults.map((voter) => (
                        <button
                          key={voter.id}
                          className="w-full p-3 text-left hover:bg-muted flex items-center justify-between group transition-colors"
                          onClick={() => addVoterToGroup({
                            id: voter.regGeneral || voter.id,
                            nombre: voter.nombres,
                            apellido: voter.apellidos,
                            enabled: true
                          })}
                          disabled={isUpdating}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{voter.nombres} {voter.apellidos}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">{voter.regGeneral || voter.id} | {voter.tipo}</p>
                          </div>
                          <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}
                   </ScrollArea>
                </div>
              )}

              {searchId.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground italic">No se encontraron coincidencias.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Votante Externo
              </CardTitle>
              <CardDescription>Agregar sin registro previo en el listado.</CardDescription>
            </CardHeader>
            <CardContent>
              {showManualForm ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombres</Label>
                    <Input value={manualNames} onChange={(e) => setManualNames(e.target.value)} placeholder="Ej: Juan" />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellidos</Label>
                    <Input value={manualLastNames} onChange={(e) => setManualLastNames(e.target.value)} placeholder="Ej: Pérez" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowManualForm(false)}>Cancelar</Button>
                    <Button className="flex-1" onClick={addManualVoter} disabled={isUpdating}>Asignar EXT-ID</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setShowManualForm(true)}>
                  Registrar Manualmente
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" /> Miembros del Grupo
                </CardTitle>
                <CardDescription>Personas actualmente enroladas en este grupo.</CardDescription>
              </div>
              <div className="text-2xl font-bold">{group.voters.length}</div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID de Registro</TableHead>
                      <TableHead>Nombre Completo</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.voters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic">
                          No hay personas enroladas aún.<br />Usa el panel lateral para buscar y agregar miembros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      group.voters.map((voter) => (
                        <TableRow key={voter.id}>
                          <TableCell className="font-mono text-xs">
                            <span className={voter.id.startsWith('EXT-') ? 'text-blue-600 font-semibold' : ''}>
                              {voter.id}
                            </span>
                          </TableCell>
                          <TableCell>{voter.nombre} {voter.apellido}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => removeVoterFromGroup(voter.id)}
                              disabled={isUpdating}
                            >
                              <Trash2 className="h-4 w-4" />
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
        </div>
      </div>
    </div>
  );
}
