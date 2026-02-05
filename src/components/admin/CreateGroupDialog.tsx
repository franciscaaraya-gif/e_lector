'use client';

import { useState, ChangeEvent, DragEvent, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { addDoc, collection, serverTimestamp, getDocs, orderBy, query, where, type Firestore, doc, documentId } from 'firebase/firestore';
import { initializeApp, getApp, type FirebaseApp, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { FileUp, Loader2, PlusCircle, Trash2, Import } from 'lucide-react';

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const formSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }).max(50, { message: 'El nombre no puede tener más de 50 caracteres.' }),
});

type ParsedVoter = {
    id: string;
    nombre: string;
    apellido: string;
    enabled: boolean;
}

type Llamado = {
    id: string;
    nombre: string;
    fecha: any;
};

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedVoters, setParsedVoters] = useState<ParsedVoter[]>([]);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [secondaryDb, setSecondaryDb] = useState<Firestore | null>(null);
  const [llamados, setLlamados] = useState<Llamado[]>([]);
  const [isLoadingLlamados, setIsLoadingLlamados] = useState(false);
  const [loadLlamadosError, setLoadLlamadosError] = useState('');
  const [selectedLlamadoId, setSelectedLlamadoId] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' },
  });

  const resetState = async () => {
    form.reset();
    setIsLoading(false);
    setIsDragging(false);
    setFileName('');
    setParsedVoters([]);
    setLlamados([]);
    setLoadLlamadosError('');
    setIsLoadingLlamados(false);
    setSelectedLlamadoId('');
    setIsImporting(false);

    try {
      if (getApp('import-app')) {
        const appInstance = getApp('import-app');
        await deleteApp(appInstance);
      }
    } catch (e) {
      // App might not have been initialized, safe to ignore
    }
    setSecondaryDb(null);
  };

  useEffect(() => {
    // Do not proceed if the dialog is closed or the user is not authenticated.
    if (!open || !user) return;

    const connectAndFetch = async () => {
        setIsLoadingLlamados(true);
        setLoadLlamadosError('');
        setLlamados([]);

        // --- GUÍA DE CONFIGURACIÓN ---
        // Pega aquí la configuración de Firebase de tu "App de Listas".
        const secondaryFirebaseConfig = {
          apiKey: "AIzaSyDgY7LvFOr5Hv4xAb2tdgUhZGUs9SO2WLw",
          authDomain: "ma-apps-2d75f.firebaseapp.com",
          projectId: "ma-apps-2d75f",
          storageBucket: "ma-apps-2d75f.firebasestorage.app",
          messagingSenderId: "841893715709",
          appId: "1:841893715709:web:30918447bb56fca4b92894"
        };
        // -----------------------------

        if (!secondaryFirebaseConfig.apiKey || secondaryFirebaseConfig.apiKey.includes("TU_API_KEY")) {
            setLoadLlamadosError("La configuración de la 'App de Listas' aún no se ha añadido. Edita este archivo para añadirla.");
            setIsLoadingLlamados(false);
            return;
        }

        try {
            let appInstance: FirebaseApp;
            try {
                appInstance = getApp('import-app');
            } catch (e) {
                appInstance = initializeApp(secondaryFirebaseConfig, 'import-app');
            }
            
            const db = getFirestore(appInstance);
            setSecondaryDb(db);

            const callsCol = collection(db, 'llamados');
            const q = query(callsCol, orderBy('fecha', 'desc'));
            const snapshot = await getDocs(q);

            const loadedLlamados = Object.values(
              snapshot.docs.reduce((acc, doc) => {
                const data = doc.data();
                if (!data) return acc;

                let fechaString = 'Fecha inválida';
                const fechaForQuery = data.fecha; // Keep original value for querying

                if (data.fecha && typeof data.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
                    const [year, month, day] = data.fecha.split('-');
                    fechaString = `${day}/${month}/${year}`;
                } else if (data.fecha && typeof data.fecha.toDate === 'function') { // Fallback for Timestamps
                    const fechaDate = data.fecha.toDate();
                    fechaString = fechaDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }
                
                const key = `${fechaString}|${data.clave || 'S/C'}|${data.direccion || 'S/D'}|${data.maquina || 'S/M'}`;
            
                if (acc[key] || !data.clave || !data.direccion || !data.maquina) return acc;
            
                acc[key] = {
                  id: key,
                  fecha: fechaForQuery, // Use original value for querying later
                  nombre: `${fechaString} - ${data.clave} - ${data.direccion} - ${data.maquina}`,
                };
            
                return acc;
              }, {} as Record<string, any>)
            );
            
            setLlamados(loadedLlamados);
        } catch (error: any) {
            console.error("Error en la conexión automática:", error);
            setLoadLlamadosError(`Error al conectar o leer datos: ${error.message}`);
        } finally {
            setIsLoadingLlamados(false);
        }
    };

    connectAndFetch();

  }, [open, user]);

  const handleFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setParsedVoters([]);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(worksheet);

        const voters = rows
            .map(row => {
                const idKey = Object.keys(row).find(k => k.toLowerCase().trim().includes('id'));
                const apellidoKey = Object.keys(row).find(k => k.toLowerCase().trim().includes('apellido'));
                const nombreKey = Object.keys(row).find(k => k.toLowerCase().trim().includes('nombre'));

                if (!idKey || !row[idKey]) return null;

                return {
                    id: String(row[idKey]).trim(),
                    apellido: apellidoKey ? String(row[apellidoKey] || '').trim() : '',
                    nombre: nombreKey ? String(row[nombreKey] || '').trim() : '',
                    enabled: true,
                };
            }).filter((v): v is ParsedVoter => v !== null);


        if (voters.length === 0){
            toast({ variant: 'destructive', title: 'Archivo no válido', description: "No se encontraron votantes. Asegúrate de que el archivo tenga una fila de cabecera con columnas que incluyan 'id', 'apellido' y 'nombre'."});
            setFileName('');
            return;
        }
        setParsedVoters(voters);
        toast({ title: 'Archivo procesado', description: `Se han encontrado ${voters.length} votantes para importar.` });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error al procesar el archivo', description: 'El formato del archivo es incorrecto.' });
        setFileName('');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => { toast({ variant: 'destructive', title: 'Error al leer el archivo' }); setIsLoading(false); }
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFile(e.target.files[0]); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleRemoveFile = () => { setFileName(''); setParsedVoters([]); const fileInput = document.getElementById('file-upload') as HTMLInputElement; if(fileInput) fileInput.value = ''; };
  
  const handleImportFromLlamado = async () => {
    if (!secondaryDb || !selectedLlamadoId) return;
  
    setIsImporting(true);
    setParsedVoters([]);
  
    try {
      const llamado = llamados.find(l => l.id === selectedLlamadoId);
      if (!llamado || !llamado.fecha) {
        throw new Error("No se pudo encontrar la fecha del llamado seleccionado.");
      }
      
      const [_fechaStr, clave, direccion, maquina] = llamado.id.split('|');

      const qLlamados = query(
        collection(secondaryDb, 'llamados'),
        where('fecha', '==', llamado.fecha),
        where('clave', '==', clave),
        where('direccion', '==', direccion),
        where('maquina', '==', maquina)
      );
  
      const llamadosSnap = await getDocs(qLlamados);
  
      if (llamadosSnap.empty) {
        toast({
          title: 'Sin voluntarios',
          description: 'Este llamado no tiene voluntarios asociados',
        });
        setIsImporting(false);
        return;
      }
  
      const volunteerIds = Array.from(new Set(llamadosSnap.docs.map(d => d.data().voluntarioId).filter(Boolean)));
  
      if (volunteerIds.length === 0) {
        toast({
          title: 'Sin voluntarios',
          description: 'Se encontraron registros del llamado, pero sin IDs de voluntarios válidos.',
        });
        setIsImporting(false);
        return;
      }
  
      const volunteers: ParsedVoter[] = [];
      const volunteersCol = collection(secondaryDb, 'voluntarios');
  
      // Firestore 'in' query supports up to 30 elements in the array
      for (let i = 0; i < volunteerIds.length; i += 30) {
        const chunk = volunteerIds.slice(i, i + 30);
        if (chunk.length === 0) continue;

        const qVols = query(
          volunteersCol,
          where(documentId(), 'in', chunk)
        );
        
        const volSnap = await getDocs(qVols);
  
        volSnap.forEach(docSnap => {
          const v = docSnap.data();
          if (v) {
            volunteers.push({
                id: v.regNacional || docSnap.id,
                nombre: v.nombre || '',
                apellido: v.apellidos || '',
                enabled: true,
            });
          }
        });
      }
  
      setParsedVoters(volunteers);
      const llamadoName = llamado?.nombre || selectedLlamadoId;
      setFileName(`Importado de: ${llamadoName}`);
      toast({ title: 'Voluntarios importados', description: `Se cargaron ${volunteers.length} voluntarios del llamado.` });
  
    } catch (error: any) {
      console.error("Error durante la importación:", error);
      let description = error.message || 'Ocurrió un error desconocido durante la importación.';
       if (error.code === 'failed-precondition' && error.message.includes('index')) {
            description = 'Falta un índice en la base de datos de "App de Listas". Revisa la consola del navegador para crearlo.';
        }
      toast({
        variant: 'destructive',
        title: 'Error al importar',
        description,
      });
    } finally {
      setIsImporting(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return toast({ variant: 'destructive', title: 'Error de Autenticación' });
    if (parsedVoters.length === 0) return toast({ variant: 'destructive', title: 'No hay votantes', description: 'Por favor, sube o importa una lista de votantes.' });

    setIsLoading(true);
    const uniqueVoters = Array.from(new Map(parsedVoters.map(item => [item.id, item])).values());
    const newGroupData = { name: values.name, adminId: user.uid, voters: uniqueVoters, createdAt: serverTimestamp() };
    const groupsCollection = collection(firestore, 'admins', user.uid, 'groups');

    try {
        await addDoc(groupsCollection, newGroupData);
        toast({ title: 'Grupo Creado', description: `El grupo "${values.name}" se creó con ${uniqueVoters.length} votantes.` });
        setOpen(false);
        resetState();
    } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: groupsCollection.path, operation: 'create', requestResourceData: newGroupData }));
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) resetState(); }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" />Crear Grupo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Grupo</DialogTitle>
          <DialogDescription>Crea un grupo de votantes subiendo un archivo o importándolo desde tu App de Listas.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto pr-6 -mr-6">
            <Form {...form}>
              <form id="create-group-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre del Grupo</FormLabel><FormControl><Input placeholder="Ej: Voluntarios de la campaña" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem>
                )}/>
                
                <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload"><FileUp className="mr-2 h-4 w-4"/>Subir Archivo</TabsTrigger>
                        <TabsTrigger value="import"><Import className="mr-2 h-4 w-4"/>Importar de App de Listas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload" className="pt-4">
                        <FormItem>
                            <FormLabel>Archivo de Votantes</FormLabel>
                            <div className={cn("relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors", isDragging && "border-primary bg-primary/10")}
                                onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onClick={() => document.getElementById('file-upload')?.click()}>
                                <FileUp className="w-10 h-10 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Haz clic para subir</span> o arrastra</p><p className="text-xs text-muted-foreground">Archivo Excel (.xlsx, .csv)</p>
                                <Input id="file-upload" type="file" className="hidden" accept=".xlsx, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} disabled={isLoading}/>
                            </div>
                            <FormDescription className="pt-2">
                                Asegúrate de que tu archivo tenga una fila de cabecera. El sistema buscará automáticamente columnas que contengan 'id', 'apellido' y 'nombre'.
                            </FormDescription>
                        </FormItem>
                    </TabsContent>
                     <TabsContent value="import" className="pt-4 space-y-4">
                        {isLoadingLlamados && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Conectando y cargando llamados...</span>
                            </div>
                        )}

                        {loadLlamadosError && <Alert variant="destructive"><AlertTitle>Error de Conexión</AlertTitle><AlertDescription>{loadLlamadosError}</AlertDescription></Alert>}

                        {!isLoadingLlamados && !loadLlamadosError && (
                            llamados.length > 0 ? (
                                <div className="space-y-4">
                                    <FormItem>
                                        <FormLabel>1. Seleccionar Llamado</FormLabel>
                                        <Select onValueChange={setSelectedLlamadoId} value={selectedLlamadoId} disabled={isImporting}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Selecciona un llamado para importar..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {llamados.map((l) => (<SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                    <Button type="button" onClick={handleImportFromLlamado} disabled={isImporting || !selectedLlamadoId || !secondaryDb}>
                                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Import className="mr-2 h-4 w-4" />}
                                        2. Importar Voluntarios del Llamado
                                    </Button>
                                </div>
                            ) : (
                                 <p className="text-sm text-muted-foreground text-center py-4">No se encontraron llamados en la aplicación de listas.</p>
                            )
                        )}
                    </TabsContent>
                </Tabs>

                {parsedVoters.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                        <div className="flex items-center justify-between"><h4 className="text-sm font-medium">Votantes a Importar: {parsedVoters.length}</h4>
                            <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={handleRemoveFile}><Trash2 className="mr-1 h-3 w-3" /> Limpiar</Button>
                        </div>
                        <p className='text-sm text-muted-foreground -mt-2'>Fuente: <span className='font-medium'>{fileName}</span>. Los IDs duplicados serán omitidos.</p>
                        <ScrollArea className="h-40 border rounded-md">
                            <Table>
                                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Nombre Completo</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {parsedVoters.map((voter, index) => (
                                        <TableRow key={`${voter.id}-${index}`}><TableCell className="font-mono text-xs">{voter.id}</TableCell><TableCell>{voter.nombre} {voter.apellido}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                )}
              </form>
            </Form>
        </div>

        <DialogFooter className="pt-4 border-t mt-auto">
          <Button type="button" variant="ghost" onClick={() => { setOpen(false); resetState(); }} disabled={isLoading}>Cancelar</Button>
          <Button type="submit" form="create-group-form" disabled={isLoading || parsedVoters.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
