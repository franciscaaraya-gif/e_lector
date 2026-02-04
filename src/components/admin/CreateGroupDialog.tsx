'use client';

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, collection as fscollection, getDocs, query, orderBy, Firestore } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { PlusCircle, Loader2, Upload, FileText } from 'lucide-react';
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
import { read, utils } from 'xlsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});

type ParsedVoter = {
  id: string;
  nombre: string;
  apellido: string;
  enabled: boolean;
};

type Llamado = {
  id: string;
  nombre: string;
  fecha: any;
};


export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedVoters, setParsedVoters] = useState<ParsedVoter[]>([]);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [secondaryDb, setSecondaryDb] = useState<Firestore | null>(null);
  const [llamados, setLlamados] = useState<Llamado[]>([]);
  const [selectedLlamadoId, setSelectedLlamadoId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' },
  });

  const connectToSecondaryDb = () => {
    // --- GUÍA DE CONFIGURACIÓN DE API ---
    // Pega aquí la configuración de Firebase de tu "App de Listas".
    const secondaryFirebaseConfig = {
      apiKey: "TU_API_KEY",
      authDomain: "TU_AUTH_DOMAIN",
      projectId: "TU_PROJECT_ID",
      storageBucket: "TU_STORAGE_BUCKET",
      messagingSenderId: "TU_MESSAGING_SENDER_ID",
      appId: "TU_APP_ID"
    };

    if (!secondaryFirebaseConfig.apiKey || !secondaryFirebaseConfig.apiKey.startsWith('AIza')) {
        toast({
            variant: "destructive",
            title: "Configuración Incompleta",
            description: "Por favor, añade la configuración de Firebase de tu 'App de Listas' en el archivo src/components/admin/CreateGroupDialog.tsx para continuar.",
        });
        return;
    }
    
    setIsConnecting(true);
    try {
        const appName = 'secondaryApp';
        let app: FirebaseApp;
        if (getApps().some(app => app.name === appName)) {
            app = getApp(appName);
        } else {
            app = initializeApp(secondaryFirebaseConfig, appName);
        }
        const db = getFirestore(app);
        setSecondaryDb(db);
        toast({ title: "Conexión exitosa", description: "Conectado a la 'App de Listas'. Ahora puedes cargar los llamados." });
    } catch(e) {
        console.error(e);
        toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudo conectar a la base de datos secundaria. Revisa la configuración." });
    } finally {
        setIsConnecting(false);
    }
  };

  useEffect(() => {
      if (secondaryDb && open) {
          loadLlamados();
      }
  }, [secondaryDb, open]);

  const loadLlamados = async () => {
      if (!secondaryDb) return;
      setIsConnecting(true);
      try {
          const snapshot = await getDocs(query(fscollection(secondaryDb, 'llamados'), orderBy('fecha', 'desc')));
          if (snapshot.empty) {
              toast({ variant: "destructive", title: "No se encontraron llamados", description: "La colección 'llamados' está vacía o no se pudo acceder." });
              setLlamados([]);
              return;
          }
          const loadedLlamados = snapshot.docs.map(doc => {
              const data = doc.data();
              let displayName = data.nombre;
              if (!displayName) {
                try {
                  const date = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
                  displayName = `Llamado del ${format(date, "d MMM yyyy", { locale: es })}`;
                } catch (e) {
                  displayName = `Llamado ID: ${doc.id}`;
                }
              }
              return {
                  id: doc.id,
                  nombre: displayName,
                  fecha: data.fecha,
              };
          });
          setLlamados(loadedLlamados);
      } catch (e: any) {
          console.error(e);
          toast({ variant: "destructive", title: "Error al cargar llamados", description: e.message });
      } finally {
          setIsConnecting(false);
      }
  };

  const handleImportFromLlamado = async () => {
      if (!secondaryDb || !selectedLlamadoId) return;
      setIsImporting(true);
      setParsedVoters([]);
      try {
          const llamadoDocRef = doc(secondaryDb, 'llamados', selectedLlamadoId);
          const llamadoDocSnap = await getDoc(llamadoDocRef);

          if (!llamadoDocSnap.exists()) {
              toast({ variant: "destructive", title: "Error", description: "El llamado seleccionado no existe." });
              setIsImporting(false);
              return;
          }

          const voluntarioIds = llamadoDocSnap.data()?.voluntarios;
          if (!Array.isArray(voluntarioIds) || voluntarioIds.length === 0) {
              toast({ title: "Sin voluntarios", description: "Este llamado no tiene voluntarios asociados." });
              setIsImporting(false);
              return;
          }
          
          const volunteerPromises = voluntarioIds.map(id => getDoc(doc(secondaryDb, 'voluntarios', String(id))));
          const volunteerDocs = await Promise.all(volunteerPromises);

          const volunteers = volunteerDocs
            .filter(docSnap => docSnap.exists())
            .map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    nombre: data.nombre || '',
                    apellido: data.apellido || '',
                    enabled: true,
                };
            });

          setParsedVoters(volunteers);
          toast({ title: "Voluntarios importados", description: `Se cargaron ${volunteers.length} voluntarios.` });
      } catch (e: any) {
          console.error(e);
          toast({ variant: "destructive", title: "Error al importar voluntarios", description: e.message });
      } finally {
          setIsImporting(false);
      }
  };
  
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        try {
            const workbook = read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = utils.sheet_to_json(worksheet, { header: 1 });

            if (json.length < 2) {
                toast({ variant: 'destructive', title: 'Archivo vacío', description: 'El archivo no contiene datos de votantes.' });
                return;
            }

            const headers: string[] = json[0].map((h: any) => String(h).toLowerCase().trim());
            const idHeaderIndex = headers.findIndex(h => h.includes('id'));
            const nombreHeaderIndex = headers.findIndex(h => h.includes('nombre'));
            const apellidoHeaderIndex = headers.findIndex(h => h.includes('apellido'));
            
            if (idHeaderIndex === -1 || nombreHeaderIndex === -1 || apellidoHeaderIndex === -1) {
                toast({ variant: 'destructive', title: 'Columnas no encontradas', description: 'El archivo debe tener columnas que incluyan "id", "nombre" y "apellido".' });
                return;
            }

            const voters: ParsedVoter[] = json.slice(1).map((row: any[]) => ({
                id: String(row[idHeaderIndex] || ''),
                nombre: String(row[nombreHeaderIndex] || ''),
                apellido: String(row[apellidoHeaderIndex] || ''),
                enabled: true,
            })).filter(v => v.id && v.nombre);

            if (voters.length > 0) {
                setParsedVoters(voters);
                toast({ title: 'Votantes Cargados', description: `Se han cargado ${voters.length} votantes del archivo.` });
            } else {
                toast({ variant: 'destructive', title: 'No se encontraron votantes válidos', description: 'Verifica que el archivo tenga datos correctos.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al leer el archivo', description: 'El formato del archivo no es válido.' });
        }
    };
    reader.readAsBinaryString(file);
  };

  const resetDialog = () => {
    form.reset({ name: '' });
    setParsedVoters([]);
    setIsLoading(false);
    setLlamados([]);
    setSelectedLlamadoId('');
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return toast({ variant: 'destructive', title: 'Error de Autenticación' });
    if (parsedVoters.length === 0) return toast({ variant: 'destructive', title: 'Sin Votantes', description: 'Agrega al menos un votante para crear el grupo.' });
    setIsLoading(true);

    try {
        await addDoc(collection(firestore, 'admins', user.uid, 'groups'), {
            name: values.name,
            voters: parsedVoters,
            adminId: user.uid,
            createdAt: serverTimestamp(),
        });

        toast({
            title: '¡Grupo Creado!',
            description: `El grupo "${values.name}" con ${parsedVoters.length} votantes ha sido creado.`,
        });

        setOpen(false);
        resetDialog();
    } catch (error: any) {
        if (error.code && error.code.startsWith('permission-denied')) {
            const permissionError = new FirestorePermissionError({
                path: `admins/${user.uid}/groups`,
                operation: 'create',
                requestResourceData: { name: values.name, voters: parsedVoters.length },
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
             toast({
                variant: 'destructive',
                title: 'Error al crear el grupo',
                description: error.message || 'Ocurrió un error inesperado.'
            });
        }
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Grupo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Grupo de Votantes</DialogTitle>
          <DialogDescription>
            Dale un nombre a tu grupo y agrega a los votantes, ya sea desde un archivo o conectando a tu App de Listas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
            <div className="flex flex-col space-y-4">
                <h3 className="text-lg font-medium">Paso 1: Define tu Grupo</h3>
                <Form {...form}>
                    <form id="create-group-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Grupo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Equipo de Desarrollo" {...field} disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
                <div className="flex-1 flex flex-col space-y-4">
                    <h3 className="text-lg font-medium">Paso 2: Agrega Votantes</h3>
                     <Tabs defaultValue="upload" className="w-full flex-1 flex flex-col">
                        <TabsList className='grid w-full grid-cols-2'>
                            <TabsTrigger value="upload">Subir Archivo</TabsTrigger>
                            <TabsTrigger value="app" onClick={connectToSecondaryDb}>Importar de App de Listas</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upload" className="mt-4 text-sm text-muted-foreground border-2 border-dashed rounded-lg p-6 text-center flex-1 flex flex-col justify-center items-center relative">
                           <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-2">Arrastra un archivo Excel (.xlsx) o CSV aquí</p>
                            <p className="text-xs">o haz clic para seleccionarlo.</p>
                            <Input type="file" className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" onChange={(e) => e.target.files && handleFile(e.target.files[0])} accept=".xlsx, .xls, .csv" />
                            <p className="text-xs mt-4">Asegúrate que tu archivo tiene columnas para "id", "nombre" y "apellido".</p>
                        </TabsContent>
                        <TabsContent value="app" className="mt-4 flex-1 flex flex-col">
                            <div className="space-y-4 p-1">
                                <h4 className="font-semibold">Conexión Automática</h4>
                                <p className="text-sm text-muted-foreground">
                                    Esta función se conecta automáticamente a tu "App de Listas". Si no funciona, asegúrate de haber añadido la configuración de Firebase de tu otra app en el archivo <code>src/components/admin/CreateGroupDialog.tsx</code>.
                                </p>
                                {isConnecting && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando llamados...</div>}
                                {secondaryDb && !isConnecting && (
                                    <div className="space-y-4">
                                        <Select onValueChange={setSelectedLlamadoId} value={selectedLlamadoId} disabled={llamados.length === 0}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona un llamado para importar" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {llamados.map(l => (
                                                    <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button onClick={handleImportFromLlamado} disabled={!selectedLlamadoId || isImporting} className="w-full">
                                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Importar Votantes del Llamado
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
             <div className="flex flex-col space-y-4">
                <h3 className="text-lg font-medium">Paso 3: Verifica los Votantes ({parsedVoters.length})</h3>
                <ScrollArea className="border rounded-md flex-1">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted">
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Apellido</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {parsedVoters.length > 0 ? (
                                parsedVoters.map(voter => (
                                    <TableRow key={voter.id}>
                                        <TableCell className="font-mono text-xs">{voter.id}</TableCell>
                                        <TableCell>{voter.nombre}</TableCell>
                                        <TableCell>{voter.apellido}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                        Aún no se han cargado votantes.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
             </div>
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="create-group-form" disabled={isLoading || parsedVoters.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Grupo con {parsedVoters.length} Votantes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
