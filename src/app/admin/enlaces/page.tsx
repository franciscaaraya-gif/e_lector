'use client';

import { useMemo, useState } from 'react';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { KeyRound, Loader2, RotateCcw, Search } from 'lucide-react';

import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ListaCompletaItem, VoterLink } from '@/lib/types';
import { linkKey } from '@/lib/personal-link';
import { formatFullName, sortPeople } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const normalizeText = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function EnlacesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'pendientes' | 'retirados'>('todos');
  const [toRegenerate, setToRegenerate] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const personalQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'admins', user.uid, 'lista_completa');
  }, [firestore, user]);
  const linksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'admins', user.uid, 'voterLinks');
  }, [firestore, user]);

  const { data: personal, isLoading: loadingP } = useCollection<ListaCompletaItem>(personalQuery);
  const { data: links, isLoading: loadingL } = useCollection<VoterLink>(linksQuery);

  const rows = useMemo(() => {
    const byKey = new Map((links || []).map(l => [l.id, l]));
    const people = sortPeople((personal || []).filter(p => (p.regGeneral || '').trim() && p.tipo !== 'Martir '));
    return people.map(p => {
      const key = linkKey(p.regGeneral || '');
      return { p, key, link: byKey.get(key) };
    });
  }, [personal, links]);

  const retirados = rows.filter(r => r.link).length;
  const pendientes = rows.length - retirados;

  const visible = useMemo(() => {
    const terms = normalizeText(search.trim()).split(/\s+/).filter(Boolean);
    return rows.filter(r => {
      if (filter === 'pendientes' && r.link) return false;
      if (filter === 'retirados' && !r.link) return false;
      if (terms.length === 0) return true;
      const full = normalizeText(`${r.p.apellidos} ${r.p.nombres} ${r.p.regGeneral || ''}`);
      return terms.every(t => full.includes(t));
    });
  }, [rows, search, filter]);

  const regenerate = async () => {
    if (!firestore || !user || !toRegenerate) return;
    setBusy(true);
    try {
      await deleteDoc(doc(firestore, 'admins', user.uid, 'voterLinks', toRegenerate.key));
      toast({ title: 'Enlace liberado', description: `${toRegenerate.name} puede retirar uno nuevo. El anterior ya no sirve.` });
      setToRegenerate(null);
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo liberar el enlace' });
    } finally { setBusy(false); }
  };

  const loading = loadingP || loadingL;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-2"><KeyRound className="h-7 w-7" /> Enlaces personales</h1>
        <p className="text-muted-foreground">Quién ya retiró su enlace para votar. «Liberar» invalida el enlace anterior y permite retirar uno nuevo.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{rows.length}</div><div className="text-xs uppercase text-muted-foreground">En la lista</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">{retirados}</div><div className="text-xs uppercase text-muted-foreground">Retiraron</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-orange-600">{pendientes}</div><div className="text-xs uppercase text-muted-foreground">Sin retirar</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Estado por persona</CardTitle>
          <CardDescription>Filtra «Sin retirar» para llamarlos a viva voz.</CardDescription>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nombre, apellido o N° de registro..." value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
            </div>
            <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="pendientes">Sin retirar</TabsTrigger>
                <TabsTrigger value="retirados">Retiraron</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : visible.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground italic py-6">Sin resultados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>N° Reg.</TableHead>
                  <TableHead>Enlace</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(({ p, key, link }) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{formatFullName(p.nombres, p.apellidos)}</TableCell>
                    <TableCell className="font-mono text-sm">{p.regGeneral}</TableCell>
                    <TableCell>
                      {link ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Retiró{link.retiradoAt?.toDate ? ` · ${format(link.retiradoAt.toDate(), 'dd/MM HH:mm')}` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-700 border-orange-300">Sin retirar</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {link && (
                        <Button size="sm" variant="outline" onClick={() => setToRegenerate({ key, name: formatFullName(p.nombres, p.apellidos) })}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Liberar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toRegenerate} onOpenChange={o => { if (!o) setToRegenerate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Liberar el enlace de {toRegenerate?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace actual dejará de funcionar y la persona deberá retirar uno nuevo con su N° de registro. Hazlo solo después de confirmar quién es.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); regenerate(); }} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
