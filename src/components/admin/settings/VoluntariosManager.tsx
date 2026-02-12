'use client';

import { useState, ChangeEvent, DragEvent } from 'react';
import * as XLSX from 'xlsx';
import { collection, writeBatch, query, where, doc } from 'firebase/firestore';
import { Copy, FileUp, Loader2, Trash2, Users } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ListaCompletaItem } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type ParsedVoluntario = Omit<ListaCompletaItem, 'id' | 'adminId'>;

const normalizeHeader = (header: string) => {
    return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function VoluntariosManager() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedVoluntarios, setParsedVoluntarios] = useState<ParsedVoluntario[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const bomberosQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'admins', user.uid, 'lista_completa'),
      where('tipo', '==', 'Bombero')
    );
  }, [firestore, user]);

  const { data: bomberos, isLoading: isLoadingBomberos } = useCollection<ListaCompletaItem>(bomberosQuery);

  const headers = "NOMBRES, APELLIDOS, C.I, REG.GENERAL, COMPAÑÍA, GRUPO SANGRE, DONANTE, ALERGIAS, CARGO, CALIDAD";

  const copyHeaders = () => {
      navigator.clipboard.writeText(headers);
      toast({
          title: "Encabezados copiados",
          description: "Los encabezados requeridos para el archivo Excel han sido copiados.",
      });
  };

  const handleFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setParsedVoluntarios([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(worksheet);

        const headerMap: { [key: string]: string } = {};
        if (rows.length > 0) {
            Object.keys(rows[0]).forEach(key => {
                headerMap[normalizeHeader(key)] = key;
            });
        }
        
        const getColumn = (normalizedName: string) => headerMap[normalizedName];

        const voluntarios = rows.map(row => {
          const cargo = row[getColumn('CARGO')] || '';
          const calidad = row[getColumn('CALIDAD')] || '';

          return {
            nombres: String(row[getColumn('NOMBRES')] || ''),
            apellidos: String(row[getColumn('APELLIDOS')] || ''),
            ci: String(row[getColumn('CI')] || ''),
            regGeneral: String(row[getColumn('REGGENERAL')] || ''),
            compania: String(row[getColumn('COMPANIA')] || ''),
            grupoSangre: String(row[getColumn('GRUPOSANGRE')] || ''),
            donante: String(row[getColumn('DONANTE')] || ''),
            alergias: String(row[getColumn('ALERGIAS')] || ''),
            cargo: cargo,
            calidad: calidad,
            tipo: cargo || calidad || 'Indefinido',
          };
        }).filter(v => v.nombres || v.apellidos);

        if (voluntarios.length === 0){
            toast({ variant: 'destructive', title: 'Archivo no válido', description: "No se encontraron voluntarios. Revisa que el archivo tenga datos y los cabezales correctos."});
            setFileName('');
            return;
        }
        setParsedVoluntarios(voluntarios);
        toast({ title: 'Archivo procesado', description: `Se han encontrado ${voluntarios.length} voluntarios para importar.` });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error al procesar el archivo', description: 'El formato del archivo es incorrecto.' });
        setFileName('');
      }
    };
    reader.onerror = () => { toast({ variant: 'destructive', title: 'Error al leer el archivo' }); }
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFile(e.target.files[0]); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleRemoveFile = () => { setFileName(''); setParsedVoluntarios([]); const fileInput = document.getElementById('voluntarios-file-upload') as HTMLInputElement; if(fileInput) fileInput.value = ''; };

  async function handleUpload() {
    if (!firestore || !user || parsedVoluntarios.length === 0) return;
    setIsUploading(true);
    
    try {
        const batch = writeBatch(firestore);
        const collectionRef = collection(firestore, 'admins', user.uid, 'lista_completa');
        
        parsedVoluntarios.forEach(voluntario => {
            const docRef = doc(collectionRef);
            batch.set(docRef, { ...voluntario, adminId: user.uid });
        });

        await batch.commit();
        toast({ title: 'Carga exitosa', description: `${parsedVoluntarios.length} voluntarios han sido añadidos a la lista completa.` });
        handleRemoveFile();
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error en la carga', description: 'No se pudieron guardar los voluntarios.' });
    } finally {
        setIsUploading(false);
    }
  }
  
  return (
    <div className="space-y-6">
      <Alert>
          <AlertTitle className="flex items-center justify-between text-sm">
              <span>Encabezados para el archivo Excel</span>
              <Button variant="ghost" size="sm" className="h-auto px-2 py-1" onClick={copyHeaders}>
                  <Copy className="mr-2 h-3 w-3" /> Copiar
              </Button>
          </AlertTitle>
          <AlertDescription className="pt-2">
              <code className="relative rounded bg-muted px-2 py-1 font-mono text-xs font-semibold block overflow-x-auto">
                  {headers}
              </code>
          </AlertDescription>
      </Alert>
      <div
        className={cn("relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors", isDragging && "border-primary bg-primary/10")}
        onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onClick={() => document.getElementById('voluntarios-file-upload')?.click()}
      >
        <FileUp className="w-10 h-10 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Haz clic para subir</span> o arrastra un archivo</p>
        <p className="text-xs text-muted-foreground">Archivo Excel (.xlsx, .csv)</p>
        <Input id="voluntarios-file-upload" type="file" className="hidden" accept=".xlsx, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} disabled={isUploading}/>
      </div>

      {parsedVoluntarios.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Voluntarios a Importar: {parsedVoluntarios.length}</h4>
            <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={handleRemoveFile}>
                    <Trash2 className="mr-1 h-3 w-3" /> Limpiar
                </Button>
                 <Button onClick={handleUpload} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Cargar a la Base de Datos
                </Button>
            </div>
          </div>
           <p className='text-sm text-muted-foreground -mt-2'>Fuente: <span className='font-mono text-xs bg-muted p-1 rounded'>{fileName}</span></p>
          <ScrollArea className="h-60 border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombres</TableHead>
                  <TableHead>Apellidos</TableHead>
                  <TableHead>Tipo (Cargo/Calidad)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedVoluntarios.map((vol, index) => (
                  <TableRow key={index}>
                    <TableCell>{vol.nombres}</TableCell>
                    <TableCell>{vol.apellidos}</TableCell>
                    <TableCell>{vol.tipo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      <div className="space-y-4 pt-6 border-t">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Users /> Listado de Bomberos</h3>
        {isLoadingBomberos && (
            <div className='border rounded-lg p-4'>
                <Skeleton className='h-8 w-full mb-2'/>
                <Skeleton className='h-8 w-full'/>
            </div>
        )}
        {!isLoadingBomberos && bomberos && bomberos.length > 0 && (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Registro</TableHead>
                        <TableHead>Apellidos</TableHead>
                        <TableHead>Nombres</TableHead>
                        <TableHead>Tipo</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {bomberos.map(b => (
                        <TableRow key={b.id}>
                            <TableCell>{b.regGeneral}</TableCell>
                            <TableCell>{b.apellidos}</TableCell>
                            <TableCell>{b.nombres}</TableCell>
                            <TableCell>{b.tipo}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}
        {!isLoadingBomberos && (!bomberos || bomberos.length === 0) && (
            <p className='text-sm text-muted-foreground text-center py-4'>No se han cargado voluntarios con el tipo "Bombero".</p>
        )}
      </div>
    </div>
  );
}
