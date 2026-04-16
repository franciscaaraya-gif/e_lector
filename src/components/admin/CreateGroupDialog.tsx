'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, PlusCircle, Trash2, Search, UserPlus, Fingerprint, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListaCompletaItem, VoterInfo } from '@/lib/types';
import { Separator } from '../ui/separator';
import { CardContent } from '../ui/card';

const formSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }).max(50, { message: 'El nombre no puede tener más de 50 caracteres.' }),
});

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [votersInGroup, setVotersInGroup] = useState<VoterInfo[]>([]);
  const [searchId, setSearchId] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualNames, setManualNames] = useState('');
  const [manualLastNames, setManualLastNames] = useState('');
  
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  // Load complete list of personnel for validation
  const personalQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'admins', user.uid, 'lista_completa');
  }, [firestore, user]);

  const { data: personnel } = useCollection<ListaCompletaItem>(personalQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' },
  });

  const resetState = () => {
    form.reset();
    setVotersInGroup([]);
    setSearchId('');
    setShowManualForm(false);
    setManualNames('');
    setManualLastNames('');
    setIsLoading(false);
  };

  // Find voter in personnel list by ID or Registry
  const foundVoterInList = useMemo(() => {
    if (!searchId.trim() || !personnel) return null;
    const search = searchId.trim().toLowerCase();
    return personnel.find(p => 
      String(p.regGeneral).toLowerCase() === search || 
      p.id.toLowerCase() === search
    );
  }, [searchId, personnel]);

  const addFoundVoter = () => {
    if (!foundVoterInList) return;
    
    // Check if already in group
    const voterIdToAdd = foundVoterInList.regGeneral || foundVoterInList.id;
    if (votersInGroup.some(v => v.id === voterIdToAdd)) {
      toast({ variant: 'destructive', title: 'Ya agregado', description: 'Este votante ya está en el grupo.' });
      return;
    }

    setVotersInGroup([...votersInGroup, {
      id: voterIdToAdd,
      nombre: foundVoterInList.nombres,
      apellido: foundVoterInList.apellidos,
      enabled: true
    }]);
    setSearchId('');
    toast({ title: 'Agregado', description: `${foundVoterInList.nombres} ha sido agregado al grupo.` });
  };

  const generateUniqueExternalId = () => {
    let isUnique = false;
    let newId = '';
    
    while (!isUnique) {
      // Formato EXT- seguido de 5 dígitos aleatorios
      const randomDigits = Math.floor(10000 + Math.random() * 90000).toString();
      newId = `EXT-${randomDigits}`;
      
      const existsInList = personnel?.some(p => String(p.regGeneral) === newId || p.id === newId);
      const existsInGroup = votersInGroup.some(v => v.id === newId);
      
      if (!existsInList && !existsInGroup) {
        isUnique = true;
      }
    }
    return newId;
  };

  const addManualVoter = () => {
    if (!manualNames.trim() || !manualLastNames.trim()) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Por favor ingresa nombre y apellido.' });
      return;
    }

    const newId = generateUniqueExternalId();

    setVotersInGroup([...votersInGroup, {
      id: newId,
      nombre: manualNames.trim(),
      apellido: manualLastNames.trim(),
      enabled: true
    }]);
    
    setManualNames('');
    setManualLastNames('');
    setShowManualForm(false);
    toast({ title: 'Votante Externo Agregado', description: `Se ha registrado temporalmente con el ID: ${newId}` });
  };

  const removeVoter = (id: string) => {
    setVotersInGroup(votersInGroup.filter(v => v.id !== id));
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return;
    if (votersInGroup.length === 0) {
      toast({ variant: 'destructive', title: 'Grupo vacío', description: 'Debes agregar al menos un votante.' });
      return;
    }

    setIsLoading(true);
    const newGroupData = {
      name: values.name,
      adminId: user.uid,
      voters: votersInGroup,
      createdAt: serverTimestamp()
    };
    
    const groupsCollection = collection(firestore, 'admins', user.uid, 'groups');

    try {
      await addDoc(groupsCollection, newGroupData);
      toast({ title: '¡Grupo Creado!', description: `El grupo "${values.name}" se creó con ${votersInGroup.length} votantes.` });
      setOpen(false);
      resetState();
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: groupsCollection.path, 
        operation: 'create', 
        requestResourceData: newGroupData 
      }));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) resetState(); }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" />Crear Grupo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[95dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Grupo de Votantes</DialogTitle>
          <DialogDescription>
            Busca personas por su ID/RFID o registra votantes externos sin registro previo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
          <Form {...form}>
            <form id="create-group-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Grupo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Junta Extraordinaria 2024" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </form>
          </Form>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <FormLabel className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4" /> Registrar por ID o RFID
              </FormLabel>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Escanea RFID o escribe número de registro..." 
                    className="pl-9"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addFoundVoter();
                        }
                    }}
                  />
                </div>
                <Button type="button" onClick={addFoundVoter} disabled={!foundVoterInList}>
                  Agregar
                </Button>
              </div>
              {searchId.trim() && !foundVoterInList && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> No se encontró ninguna persona con ese ID en el listado de personal.
                </p>
              )}
              {foundVoterInList && (
                <Alert className="bg-primary/5 border-primary/20 py-2">
                  <AlertDescription className="text-sm font-medium flex justify-between items-center">
                    <span>Encontrado: {foundVoterInList.nombres} {foundVoterInList.apellidos}</span>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border">{foundVoterInList.tipo}</span>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-3">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="w-full text-xs" 
                onClick={() => setShowManualForm(!showManualForm)}
              >
                <UserPlus className="mr-2 h-4 w-4" /> 
                {showManualForm ? "Cancelar registro externo" : "Agregar votante externo (sin registro previo)"}
              </Button>

              {showManualForm && (
                <div className="border rounded-md p-4 space-y-3 bg-muted/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <FormLabel className="text-xs">Nombres</FormLabel>
                      <Input value={manualNames} onChange={(e) => setManualNames(e.target.value)} placeholder="Ej: Juan Pedro" />
                    </div>
                    <div className="space-y-1">
                      <FormLabel className="text-xs">Apellidos</FormLabel>
                      <Input value={manualLastNames} onChange={(e) => setManualLastNames(e.target.value)} placeholder="Ej: Soto Pérez" />
                    </div>
                  </div>
                  <Button type="button" size="sm" className="w-full" onClick={addManualVoter}>
                    Asignar ID Externo y Agregar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex justify-between">
              Votantes en el grupo: <span>{votersInGroup.length}</span>
            </h4>
            <div className="border rounded-md">
              <ScrollArea className="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">ID/Reg</TableHead>
                      <TableHead>Nombre Completo</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {votersInGroup.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground text-xs italic">
                          No se han agregado votantes al grupo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      votersInGroup.map((voter) => (
                        <TableRow key={voter.id}>
                          <TableCell className="font-mono text-xs">{voter.id}</TableCell>
                          <TableCell className="text-xs">{voter.nombre} {voter.apellido}</TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeVoter(voter.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="create-group-form" disabled={isLoading || votersInGroup.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
