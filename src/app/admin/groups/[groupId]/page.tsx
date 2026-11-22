'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useMemo, useEffect, useRef } from 'react';
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
  Check,
  Edit2,
  ShieldCheck,
  Eye,
  EyeOff,
  Keyboard
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
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sortPeople, formatFullName } from '@/lib/utils';
import { OnScreenKeyboard } from '@/components/ui/on-screen-keyboard';

// Los lectores RFID se comportan como teclado: escriben el código y luego Enter.
// Se normaliza para tolerar guiones, espacios, mayúsculas y ceros a la izquierda.
const normalizeRfid = (value: unknown): string => {
  const cleaned = String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const noZeros = cleaned.replace(/^0+/, '');
  return noZeros;
};

type ScanFeedback = { kind: 'ok' | 'dup' | 'unknown'; text: string };

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
  const [showIds, setShowIds] = useState(false);

  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbTarget, setKbTarget] = useState<'search' | 'names' | 'lastnames'>('search');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const votersRef = useRef<VoterInfo[]>([]);
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // Get current group data
  const groupRef = useMemoFirebase(() => {
    if (!firestore || !user || !groupId) return null;
    return doc(firestore, 'admins', user.uid, 'groups', groupId);
  }, [firestore, user, groupId]);

  const { data: group, isLoading: isGroupLoading } = useDoc<VoterGroup>(groupRef);

  useEffect(() => {
    if (group) {
        setNewName(group.name);
        votersRef.current = group.voters || [];
    }
  }, [group]);

  // Enfocar el buscador al abrir la página (listo para escribir o pasar la tarjeta)
  useEffect(() => {
    const t = setTimeout(() => searchInputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // Load personnel list for lookup
  const personalQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'admins', user.uid, 'lista_completa');
  }, [firestore, user]);

  const { data: personnel } = useCollection<ListaCompletaItem>(personalQuery);

  const rfidMap = useMemo(() => {
    const map = new Map<string, ListaCompletaItem>();
    (personnel || []).forEach(p => {
      const key = normalizeRfid(p.rfid);
      if (key) map.set(key, p);
    });
    return map;
  }, [personnel]);

  // Búsqueda única: nombre, apellido, N° de registro o código de tarjeta
  const searchResults = useMemo(() => {
    const raw = searchId.trim();
    if (!raw || !personnel) return [];

    // ¿Es el código de una tarjeta registrada?
    const cardOwner = rfidMap.get(normalizeRfid(raw));
    if (cardOwner) return [cardOwner];

    const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const terms = norm(raw).split(/\s+/).filter(Boolean);
    const isNumeric = /^\d+$/.test(raw);
    if (!isNumeric && raw.length < 2) return [];

    const filtered = personnel.filter(p => {
      if (isNumeric) {
        // N° de registro exacto (sin ceros a la izquierda)
        return (p.regGeneral || '').replace(/^0+/, '') === raw.replace(/^0+/, '');
      }
      const full = norm(`${p.apellidos} ${p.nombres}`);
      return terms.every(t => full.includes(t));
    });

    return sortPeople(filtered, (p) => ({ nombres: p.nombres, apellidos: p.apellidos })).slice(0, 10);
  }, [searchId, personnel, rfidMap]);

  const sortedMembers = useMemo(() => {
    if (!group?.voters) return [];
    return sortPeople(group.voters, (v) => ({ nombres: v.nombre, apellidos: v.apellido }));
  }, [group?.voters]);

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
      toast({ title: 'Agregado', description: `${voter.nombre} ha sido añadido al grupo.` });
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

  // Agrega una persona de forma segura aunque se pasen tarjetas muy seguidas.
  // Devuelve true si se agregó, false si ya estaba.
  const addVoterQueued = (voter: VoterInfo): Promise<boolean> => {
    if (!groupRef) return Promise.resolve(false);
    if (votersRef.current.some(v => v.id === voter.id)) return Promise.resolve(false);
    const updatedVoters = [...votersRef.current, voter];
    votersRef.current = updatedVoters;
    const run = writeChain.current.then(async () => {
      try {
        await updateDoc(groupRef, { voters: updatedVoters });
      } catch (error) {
        votersRef.current = votersRef.current.filter(v => v.id !== voter.id);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: groupRef.path,
          operation: 'update',
          requestResourceData: { voters: updatedVoters }
        }));
        throw error;
      }
    });
    writeChain.current = run.catch(() => {});
    return run.then(() => true);
  };

  const kbChange = (updater: (prev: string) => string) => {
    if (kbTarget === 'names') setManualNames(updater);
    else if (kbTarget === 'lastnames') setManualLastNames(updater);
    else setSearchId(updater);
  };

  const openKeyboard = () => {
    setKbTarget('search');
    setKbOpen(true);
  };

  // Agrega a una persona encontrada (por tarjeta, registro o nombre) con aviso visible
  const enrollPerson = async (person: ListaCompletaItem) => {
    if (!group) return;
    const name = formatFullName(person.nombres, person.apellidos);
    setSearchId('');
    try {
      const added = await addVoterQueued({
        id: person.regGeneral || person.id,
        nombre: person.nombres,
        apellido: person.apellidos,
        enabled: true
      });
      setScanFeedback(added
        ? { kind: 'ok', text: `${name} agregado/a al grupo.` }
        : { kind: 'dup', text: `${name} ya estaba en el grupo.` });
    } catch {
      setScanFeedback({ kind: 'unknown', text: `No se pudo agregar a ${name}.` });
    }
    searchInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const raw = searchId.trim();
    if (!raw) return;

    if (searchResults.length === 1) {
      enrollPerson(searchResults[0]);
      return;
    }
    if (searchResults.length === 0) {
      // Si parece un código de tarjeta (sin espacios, con algún dígito), avisar que no está registrada
      if (!/\s/.test(raw) && /\d/.test(raw) && raw.length >= 5) {
        setScanFeedback({ kind: 'unknown', text: 'Tarjeta no registrada. Búscala por nombre o vincúlala en Configuración.' });
        setSearchId('');
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

  const handleUpdateGroupName = async () => {
    if (!groupRef || !newName.trim()) return;
    setIsUpdating(true);
    try {
        await updateDoc(groupRef, { name: newName.trim() });
        toast({ title: 'Nombre Actualizado', description: 'El nombre del grupo ha sido cambiado.' });
        setIsEditNameOpen(false);
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el nombre.' });
    } finally {
        setIsUpdating(false);
    }
  }

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
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditNameOpen(true)}>
             <h1 className="text-2xl font-bold font-headline">{group.name}</h1>
             <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-full border">
                <Switch 
                    id="show-ids" 
                    checked={showIds} 
                    onCheckedChange={setShowIds}
                    className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="show-ids" className="text-[10px] uppercase font-bold cursor-pointer flex items-center gap-1.5">
                    {showIds ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    Mostrar N° de registro
                </Label>
            </div>
            {isUpdating && (
                <div className="flex items-center text-sm text-muted-foreground animate-pulse">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                </div>
            )}
        </div>
      </div>

      <Dialog open={isEditNameOpen} onOpenChange={setIsEditNameOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Editar Nombre del Grupo</DialogTitle>
                  <DialogDescription>Cambia el nombre para identificar mejor este grupo de votantes.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <Label>Nombre del Grupo</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Asamblea Ordinaria" />
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsEditNameOpen(false)}>Cancelar</Button>
                  <Button onClick={handleUpdateGroupName} disabled={isUpdating || !newName.trim()}>
                      Guardar Cambios
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Enrolamiento
              </CardTitle>
              <CardDescription>Una sola barra: escribe nombre, apellido o N° de registro, o pasa la tarjeta RFID.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant={kbOpen ? 'default' : 'outline'}
                size="sm"
                className="w-full"
                onClick={() => (kbOpen ? setKbOpen(false) : openKeyboard())}
              >
                <Keyboard className="h-4 w-4 mr-2" />
                {kbOpen ? 'Ocultar teclado en pantalla' : 'Mostrar teclado en pantalla'}
              </Button>

              <div className="relative">
                <Input 
                  placeholder="Nombre, apellido, N° de registro o pasa la tarjeta..." 
                  autoComplete="off" 
                  className="bg-primary/5 focus:bg-background transition-colors"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setKbTarget('search')}
                  inputMode={kbOpen ? 'none' : undefined}
                  ref={searchInputRef}
                />
              </div>
              
              {scanFeedback && (
                <div
                  className={
                    'text-sm rounded-md border p-3 text-center font-medium ' +
                    (scanFeedback.kind === 'ok'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : scanFeedback.kind === 'dup'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-destructive/10 border-destructive/30 text-destructive')
                  }
                >
                  {scanFeedback.text}
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="border rounded-md divide-y overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                   <ScrollArea className={searchResults.length > 3 ? "h-64" : "h-auto"}>
                    {searchResults.map((voter) => (
                        <button
                          key={voter.id}
                          className="w-full p-3 text-left hover:bg-muted flex items-center justify-between group transition-colors"
                          onClick={() => enrollPerson(voter)}
                          disabled={isUpdating}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{formatFullName(voter.nombres, voter.apellidos)}</p>
                            <p className="text-[10px] text-muted-foreground truncate uppercase">
                                {voter.tipo}
                            </p>
                          </div>
                          <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}
                   </ScrollArea>
                </div>
              )}

              {searchId.trim().length >= 2 && searchResults.length === 0 && !/^\S*\d\S*$/.test(searchId.trim()) && (
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
              <CardDescription>Agregar sin registro previo.</CardDescription>
            </CardHeader>
            <CardContent>
              {showManualForm ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombres</Label>
                    <Input value={manualNames} onChange={(e) => setManualNames(e.target.value)} onFocus={() => setKbTarget('names')} inputMode={kbOpen ? 'none' : undefined} placeholder="Ej: Juan" />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellidos</Label>
                    <Input value={manualLastNames} onChange={(e) => setManualLastNames(e.target.value)} onFocus={() => setKbTarget('lastnames')} inputMode={kbOpen ? 'none' : undefined} placeholder="Ej: Pérez" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowManualForm(false)}>Cancelar</Button>
                    <Button className="flex-1" onClick={addManualVoter} disabled={isUpdating}>Registrar</Button>
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
                      {showIds && <TableHead className="w-32">N° Registro</TableHead>}
                      <TableHead>Nombre Completo</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.voters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={showIds ? 3 : 2} className="h-32 text-center text-muted-foreground italic">
                          No hay personas enroladas aún.<br />Usa el panel lateral para buscar y agregar miembros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedMembers.map((voter) => (
                        <TableRow key={voter.id}>
                          {showIds && (
                             <TableCell className="font-mono text-xs">
                                <span className={voter.id.startsWith('EXT-') ? 'text-blue-600 font-semibold' : ''}>
                                    {voter.id}
                                </span>
                             </TableCell>
                          )}
                          <TableCell className="font-medium">{formatFullName(voter.nombre, voter.apellido)}</TableCell>
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

      {kbOpen && (
        <>
          <div className="h-80" aria-hidden />
          <OnScreenKeyboard
            onChange={kbChange}
            onEnter={kbTarget === 'search' ? () => handleKeyDown({ key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>) : undefined}
            onClose={() => setKbOpen(false)}
          />
        </>
      )}
    </div>
  );
}
