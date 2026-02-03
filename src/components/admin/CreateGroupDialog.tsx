'use client';

import { useState, ChangeEvent, DragEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }).max(50, { message: 'El nombre no puede tener más de 50 caracteres.' }),
});

type ParsedVoter = {
    id: string;
    nombre: string;
    apellido: string;
    enabled: boolean;
}

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedVoters, setParsedVoters] = useState<ParsedVoter[]>([]);
  const [activeTab, setActiveTab] = useState('upload');
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  const resetState = () => {
    form.reset();
    setIsLoading(false);
    setIsDragging(false);
    setFileName('');
    setParsedVoters([]);
    setActiveTab('upload');
  };

  const handleFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        const voters = rows
            .filter(row => Array.isArray(row) && row[0]) // Filter out empty rows or rows without an ID
            .map(row => ({
                id: String(row[0]).trim(),
                apellido: String(row[1] || '').trim(),
                nombre: String(row[2] || '').trim(),
                enabled: true,
            }));

        if (voters.length === 0){
            toast({
                variant: 'destructive',
                title: 'Archivo no válido',
                description: "No se encontraron votantes válidos. Asegúrate de que la primera columna de tu archivo contenga los IDs."
            })
            setFileName('');
            return;
        }

        setParsedVoters(voters);
      } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error al procesar el archivo',
            description: 'El formato del archivo es incorrecto. Por favor, utiliza un archivo .xlsx o .csv válido.'
        });
        setFileName('');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
        toast({
            variant: 'destructive',
            title: 'Error al leer el archivo',
            description: 'No se pudo leer el archivo seleccionado.'
        });
        setIsLoading(false);
    }
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFile(e.target.files[0]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleRemoveFile = () => {
    setFileName('');
    setParsedVoters([]);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  }
  
  const handleImportFromApp = () => {
    // --- PUNTO DE INTEGRACIÓN ---
    // Aquí es donde conectarías con la API de tu "App de Listas".
    // Deberías reemplazar los datos de ejemplo con una llamada `fetch` a tu API.
    
    /*
    // EJEMPLO DE CÓMO PODRÍA SER LA LLAMADA A TU API:
    const fetchVotersFromApi = async () => {
        try {
            // Reemplaza esta URL con el endpoint real de tu API
            const response = await fetch('https://api.tu-app-de-listas.com/voters');
            if (!response.ok) {
                throw new Error('No se pudo conectar con la API');
            }
            const data = await response.json();

            // Asegúrate de que los datos de la API tengan el formato correcto:
            // { id: string, nombre: string, apellido: string }
            const formattedVoters = data.map(voter => ({
                id: voter.id,
                nombre: voter.firstName, // ajusta los nombres de los campos
                apellido: voter.lastName, // ajusta los nombres de los campos
                enabled: true,
            }));
            
            setParsedVoters(formattedVoters);
            setFileName('Importado desde la API');
            toast({
                title: '¡Lista importada!',
                description: `Se han cargado ${'${formattedVoters.length}'} votantes.`,
            });

        } catch (error) {
            console.error("Error al importar desde la API:", error);
            toast({
                variant: 'destructive',
                title: 'Error de importación',
                description: 'No se pudo obtener la lista desde la API.',
            });
        }
    };
    
    fetchVotersFromApi();
    */

    // --- SIMULACIÓN ACTUAL (REEMPLAZAR CON LA LÓGICA DE ARRIBA) ---
    toast({
        title: 'Simulación de Importación',
        description: 'En un caso real, esto conectaría a tu app. Se han cargado datos de ejemplo.',
    });
    const exampleVoters = [
        { id: 'usr_001', apellido: 'García', nombre: 'Ana', enabled: true },
        { id: 'usr_002', apellido: 'Martínez', nombre: 'Luis', enabled: true },
        { id: 'usr_003', apellido: 'López', nombre: 'Elena', enabled: true },
    ];
    setParsedVoters(exampleVoters);
    setFileName('Importado desde la App de Listas');
  };


  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Error de Autenticación' });
      return;
    }
    if(parsedVoters.length === 0){
        toast({ variant: 'destructive', title: 'No hay votantes', description: 'Por favor, sube o importa una lista de votantes.' });
        return;
    }

    setIsLoading(true);

    const uniqueVoters = Array.from(new Map(parsedVoters.map(item => [item.id, item])).values());

    const groupsCollection = collection(firestore, 'admins', user.uid, 'groups');
    const newGroupData = {
        name: values.name,
        adminId: user.uid,
        voters: uniqueVoters,
        createdAt: serverTimestamp(),
    };

    addDoc(groupsCollection, newGroupData)
        .then(() => {
            toast({
                title: 'Grupo Creado',
                description: `El grupo "${values.name}" ha sido creado con ${uniqueVoters.length} votantes.`,
            });
            resetState();
            setOpen(false);
        })
        .catch((error) => {
            const permissionError = new FirestorePermissionError({
                path: groupsCollection.path,
                operation: 'create',
                requestResourceData: newGroupData,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsLoading(false);
        });
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) resetState(); }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Grupo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Grupo</DialogTitle>
          <DialogDescription>
            Sube un archivo o importa desde tu app para crear un nuevo grupo de votantes.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Grupo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Empleados de la empresa" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value="upload">Subir Archivo</TabsTrigger>
                <TabsTrigger value="import">Importar de App</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-4">
                 <FormItem>
                    <FormLabel className='sr-only'>Archivo de Votantes</FormLabel>
                    <div 
                        className={cn("relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors",
                            isDragging && "border-primary bg-primary/10"
                        )}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onClick={() => document.getElementById('file-upload')?.click()}
                    >
                        <FileUp className="w-10 h-10 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">
                            <span className="font-semibold text-primary">Haz clic para subir</span> o arrastra
                        </p>
                        <p className="text-xs text-muted-foreground">Archivo Excel (.xlsx, .csv)</p>
                        <Input 
                            id="file-upload" 
                            type="file" 
                            className="hidden" 
                            accept=".xlsx, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                            onChange={handleFileChange}
                            disabled={isLoading}
                        />
                    </div>
                    <FormDescription className="pt-2">
                        Se usará la primera columna para el 'id', la segunda para 'apellido' y la tercera para 'nombre'.
                    </FormDescription>
                </FormItem>
              </TabsContent>
              <TabsContent value="import" className="mt-4">
                <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-dashed rounded-lg">
                    <Import className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">Importar desde tu App de Listas</h3>
                    <p className="text-sm text-muted-foreground mt-2 mb-4 max-w-sm">
                        Conecta y selecciona una lista de votantes desde tu aplicación externa.
                    </p>
                    <Button type="button" onClick={handleImportFromApp}>
                        <Import className="mr-2 h-4 w-4" />
                        Conectar y Seleccionar Lista
                    </Button>
                </div>
              </TabsContent>
            </Tabs>


            {parsedVoters.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">
                            Votantes a Importar: {parsedVoters.length}
                        </h4>
                        <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={handleRemoveFile}>
                           <Trash2 className="mr-1 h-3 w-3" /> Limpiar
                        </Button>
                    </div>
                    <p className='text-sm text-muted-foreground -mt-2'>
                        Archivo: <span className='font-medium'>{fileName}</span>. Duplicados serán omitidos.
                    </p>
                    <ScrollArea className="h-40 border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Nombre Completo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parsedVoters.map((voter, index) => (
                                    <TableRow key={`${voter.id}-${index}`}>
                                        <TableCell className="font-mono text-xs">{voter.id}</TableCell>
                                        <TableCell>{voter.nombre} {voter.apellido}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            )}


            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || parsedVoters.length === 0}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Grupo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
