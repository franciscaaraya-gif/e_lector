'use client';

import { useState, ChangeEvent, DragEvent } from 'react';
import * as XLSX from 'xlsx';
import { collection, writeBatch, query, where, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Copy, FileUp, Loader2, Trash2, Users, AlertTriangle, CreditCard, Check } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';


type ParsedVoluntario = Omit<ListaCompletaItem, 'id' | 'adminId'>;

const normalizeHeader = (header: string) => {
    return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function VoluntariosManager() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedVoluntarios, setParsedVoluntarios] = useState<ParsedVoluntario[]>([]);
  const [parsedRfid, setParsedRfid] = useState<{reg: string, card: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const personalQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'admins', user.uid, 'lista_completa'),
      where('tipo', 'not-in', ['Martir '])
    );
  }, [firestore, user]);

  const { data: personal, isLoading: isLoadingPersonal } = useCollection<ListaCompletaItem>(personalQuery);

  const headersPersonal = "Registro,Rut,Digito,Nombre,Segundo Nombre,Primer Apellido,Segundo Apellido,Sangre Grupo,Sangre Rh,Calidad,Cargo";
  const headersRfid = "Registro,TarjetaID";

  const handleFilePersonal = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        const headerMap: any = {};
        if (rows.length > 0) Object.keys(rows[0]).forEach(k => headerMap[normalizeHeader(k)] = k);
        const getCol = (n: string) => headerMap[n];

        const results = rows.map((row): ParsedVoluntario | null => {
          const nombres = `${row[getCol('NOMBRE')] || ''} ${row[getCol('SEGUNDONOMBRE')] || ''}`.trim();
          const apellidos = `${row[getCol('PRIMERAPELLIDO')] || ''} ${row[getCol('SEGUNDOAPELLIDO')] || ''}`.trim();
          if (!nombres && !apellidos) return null;

          const cargo = String(row[getCol('CARGO')] || '').trim();
          const calidad = String(row[getCol('CALIDAD')] || '').trim();
          const tipoFinal = (cargo && cargo !== '-') ? cargo : ((calidad && calidad !== '-') ? calidad : 'Voluntarios');

          return {
            nombres, apellidos,
            ci: `${row[getCol('RUT')] || ''}-${row[getCol('DIGITO')] || ''}`,
            regGeneral: String(row[getCol('REGISTRO')] || ''),
            tipo: tipoFinal,
            grupoSangre: `${row[getCol('SANGREGRUPO')] || ''}${row[getCol('SANGRERH')] || ''}`,
          };
        }).filter((v): v is ParsedVoluntario => v !== null);

        setParsedVoluntarios(results);
        toast({ title: 'Personal procesado', description: `${results.length} voluntarios encontrados.` });
      } catch (err) { toast({ variant: 'destructive', title: 'Error al procesar' }); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileRfid = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        const headerMap: any = {};
        if (rows.length > 0) Object.keys(rows[0]).forEach(k => headerMap[normalizeHeader(k)] = k);
        const getCol = (n: string) => headerMap[n];

        const results = rows.map(row => ({
          reg: String(row[getCol('REGISTRO')] || '').trim(),
          card: String(row[getCol('TARJETAID')] || '').trim()
        })).filter(r => r.reg && r.card);

        setParsedRfid(results);
        toast({ title: 'Tarjetas procesadas', description: `${results.length} tarjetas encontradas.` });
      } catch (err) { toast({ variant: 'destructive', title: 'Error al procesar RFID' }); }
    };
    reader.readAsArrayBuffer(file);
  };

  async function uploadPersonal() {
    if (!firestore || !user || parsedVoluntarios.length === 0) return;
    setIsUploading(true);
    try {
        const batch = writeBatch(firestore);
        const colRef = collection(firestore, 'admins', user.uid, 'lista_completa');
        const snap = await getDocs(query(colRef, where('tipo', '!=', 'Martir ')));
        snap.docs.forEach(d => batch.delete(d.ref));
        parsedVoluntarios.forEach(v => batch.set(doc(colRef), { ...v, adminId: user.uid }));
        await batch.commit();
        toast({ title: 'Carga exitosa' });
        setParsedVoluntarios([]);
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsUploading(false); }
  }

  async function uploadRfid() {
    if (!firestore || !user || parsedRfid.length === 0) return;
    setIsUploading(true);
    try {
        const colRef = collection(firestore, 'admins', user.uid, 'lista_completa');
        const snap = await getDocs(colRef);
        const batch = writeBatch(firestore);
        let updatedCount = 0;

        parsedRfid.forEach(rfid => {
            const item = snap.docs.find(d => (d.data() as ListaCompletaItem).regGeneral === rfid.reg);
            if (item) {
                batch.update(item.ref, { rfid: rfid.card });
                updatedCount++;
            }
        });

        await batch.commit();
        toast({ title: 'RFID Actualizado', description: `Se vincularon ${updatedCount} tarjetas.` });
        setParsedRfid([]);
    } catch (e) { toast({ variant: 'destructive', title: 'Error RFID' }); } finally { setIsUploading(false); }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="personal">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personal">Cargar Personal</TabsTrigger>
            <TabsTrigger value="rfid">Vincular Tarjetas RFID</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4 pt-4">
            <Alert>
                <AlertTitle className="text-sm">Encabezados Personal</AlertTitle>
                <AlertDescription className="font-mono text-[10px] break-all">{headersPersonal}</AlertDescription>
            </Alert>
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer" onClick={() => document.getElementById('file-personal')?.click()}>
                <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-xs mt-2">Sube Excel de Voluntarios</p>
                <input id="file-personal" type="file" className="hidden" onChange={(e) => e.target.files && handleFilePersonal(e.target.files[0])} />
            </div>
            {parsedVoluntarios.length > 0 && (
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-xs font-medium">{parsedVoluntarios.length} voluntarios listos.</span>
                    <Button size="sm" onClick={uploadPersonal} disabled={isUploading}>
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Carga'}
                    </Button>
                </div>
            )}
        </TabsContent>

        <TabsContent value="rfid" className="space-y-4 pt-4">
             <Alert variant="default" className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Vinculación de Tarjetas</AlertTitle>
                <AlertDescription className="text-xs">Usa este Excel para asignar IDs de tarjetas a registros ya cargados.</AlertDescription>
            </Alert>
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer" onClick={() => document.getElementById('file-rfid')?.click()}>
                <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-xs mt-2">Sube Excel de Tarjetas (Registro, TarjetaID)</p>
                <input id="file-rfid" type="file" className="hidden" onChange={(e) => e.target.files && handleFileRfid(e.target.files[0])} />
            </div>
            {parsedRfid.length > 0 && (
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-xs font-medium">{parsedRfid.length} vinculaciones listas.</span>
                    <Button size="sm" onClick={uploadRfid} disabled={isUploading}>
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar Tarjetas'}
                    </Button>
                </div>
            )}
        </TabsContent>
      </Tabs>

      <div className="pt-6 border-t">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Users /> Listado de Personal Activo</h3>
        <ScrollArea className="h-80 border rounded-md">
            <Table>
                <TableHeader><TableRow><TableHead>Reg.</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>RFID</TableHead></TableRow></TableHeader>
                <TableBody>
                    {personal?.map(p => (
                        <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.regGeneral}</TableCell>
                            <TableCell className="text-xs">{p.nombres} {p.apellidos}</TableCell>
                            <TableCell className="text-xs">{p.tipo}</TableCell>
                            <TableCell className="text-xs">
                                {p.rfid ? <Badge variant="secondary" className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" /> {p.rfid}</Badge> : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
      </div>
    </div>
  );
}