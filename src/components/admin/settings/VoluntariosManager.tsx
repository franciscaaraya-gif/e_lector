'use client';

import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { collection, writeBatch, query, where, doc, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { FileUp, Loader2, Users, CreditCard, Check, Eye, EyeOff, Search, X } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ListaCompletaItem } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { sortPeople, formatFullName } from '@/lib/utils';


type ParsedVoluntario = Omit<ListaCompletaItem, 'id' | 'adminId'>;

const normalizeHeader = (header: string) => {
    return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const normalizeRfid = (value: unknown): string =>
    String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/^0+/, '');
const normalizeText = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Asignar, cambiar o quitar la tarjeta de UNA persona escaneándola
function RfidIndividual({ personal }: { personal: ListaCompletaItem[] }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ListaCompletaItem | null>(null);
  const [scan, setScan] = useState('');
  const [saving, setSaving] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const terms = normalizeText(search).split(/\s+/).filter(Boolean);
    if (terms.length === 0 || selected) return [];
    const filtered = personal.filter(p => {
      const full = normalizeText(`${p.apellidos} ${p.nombres}`);
      return terms.every(t => full.includes(t));
    });
    return sortPeople(filtered, (p) => ({ nombres: p.nombres, apellidos: p.apellidos })).slice(0, 8);
  }, [search, personal, selected]);

  const choose = (p: ListaCompletaItem) => {
    setSelected(p);
    setSearch('');
    setScan('');
    setTimeout(() => scanRef.current?.focus(), 50);
  };

  const save = async () => {
    if (!firestore || !user || !selected) return;
    const code = scan.trim();
    const key = normalizeRfid(code);
    if (!key) return;
    const owner = personal.find(p => p.id !== selected.id && normalizeRfid(p.rfid) === key);
    if (owner) {
      toast({
        variant: 'destructive',
        title: 'Tarjeta ya asignada',
        description: `Esta tarjeta ya pertenece a ${formatFullName(owner.nombres, owner.apellidos)}. Quítasela primero.`,
      });
      setScan('');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'admins', user.uid, 'lista_completa', selected.id), { rfid: code });
      toast({ title: 'Tarjeta guardada', description: `${formatFullName(selected.nombres, selected.apellidos)} quedó vinculado/a.` });
      setSelected(null);
      setScan('');
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo guardar la tarjeta' });
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!firestore || !user || !selected) return;
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'admins', user.uid, 'lista_completa', selected.id), { rfid: deleteField() });
      toast({ title: 'Tarjeta quitada' });
      setSelected(null);
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo quitar la tarjeta' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Una tarjeta a la vez</AlertTitle>
        <AlertDescription className="text-xs">Busca al voluntario por nombre, pasa su tarjeta por el lector y guarda. Sirve para asignar, cambiar o quitar una tarjeta.</AlertDescription>
      </Alert>

      {!selected ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar voluntario por apellido o nombre..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
          </div>
          {results.length > 0 && (
            <div className="border rounded-md divide-y">
              {results.map(p => (
                <button key={p.id} type="button" className="w-full p-3 text-left hover:bg-muted flex items-center justify-between" onClick={() => choose(p)}>
                  <span className="text-sm font-medium">{formatFullName(p.nombres, p.apellidos)}</span>
                  {p.rfid ? <Badge variant="secondary" className="bg-green-100 text-green-800">Con tarjeta</Badge> : <span className="text-xs text-muted-foreground">Sin tarjeta</span>}
                </button>
              ))}
            </div>
          )}
          {search.trim() && results.length === 0 && <p className="text-xs text-center text-muted-foreground italic">Sin coincidencias.</p>}
        </div>
      ) : (
        <div className="space-y-3 border rounded-md p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold">{formatFullName(selected.nombres, selected.apellidos)}</p>
              <p className="text-xs text-muted-foreground">
                {selected.rfid ? `Tarjeta actual: ${selected.rfid}` : 'Aún sin tarjeta'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setSelected(null); setScan(''); }}><X className="h-4 w-4" /></Button>
          </div>
          <Input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            placeholder="Pasa la tarjeta por el lector (o escribe el código)..."
            autoComplete="off"
            autoFocus
            className="text-center font-mono"
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving || !scan.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (selected.rfid ? 'Cambiar tarjeta' : 'Guardar tarjeta')}
            </Button>
            {selected.rfid && (
              <Button variant="outline" onClick={remove} disabled={saving}>Quitar tarjeta</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function VoluntariosManager() {
  const [fileName, setFileName] = useState('');
  const [parsedVoluntarios, setParsedVoluntarios] = useState<ParsedVoluntario[]>([]);
  const [parsedRfid, setParsedRfid] = useState<{reg: string, card: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showIds, setShowIds] = useState(false);
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

  const sortedPersonal = useMemo(() => {
    return sortPeople(personal, (p) => ({ nombres: p.nombres, apellidos: p.apellidos }));
  }, [personal]);

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
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Cargar Personal</TabsTrigger>
            <TabsTrigger value="rfid">Tarjetas (Excel)</TabsTrigger>
            <TabsTrigger value="rfid-uno">Tarjeta individual</TabsTrigger>
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

        <TabsContent value="rfid-uno" className="pt-4">
            <RfidIndividual personal={sortedPersonal || []} />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Users /> Listado de Personal Activo</h3>
            <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-full border w-fit">
                <Switch 
                    id="show-ids-settings" 
                    checked={showIds} 
                    onCheckedChange={setShowIds}
                    className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="show-ids-settings" className="text-[10px] uppercase font-bold cursor-pointer flex items-center gap-1.5">
                    {showIds ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    Mostrar N° de registro
                </Label>
            </div>
        </div>
        <ScrollArea className="h-80 border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        {showIds && <TableHead className="w-24">Reg.</TableHead>}
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>RFID</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedPersonal?.map(p => (
                        <TableRow key={p.id}>
                            {showIds && <TableCell className="font-mono text-xs">{p.regGeneral}</TableCell>}
                            <TableCell className="text-xs font-medium">
                                {formatFullName(p.nombres, p.apellidos)}
                            </TableCell>
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
