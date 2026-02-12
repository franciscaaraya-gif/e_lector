'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ListaCompletaItem, OrdenLista } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ListOrdered } from 'lucide-react';

export function OrdenListaManager() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const listaCompletaQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'admins', user.uid, 'lista_completa'));
  }, [firestore, user]);

  const ordenListaQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'admins', user.uid, 'orden_lista'));
  }, [firestore, user]);

  const { data: listaCompleta, isLoading: isLoadingLista } = useCollection<ListaCompletaItem>(listaCompletaQuery);
  const { data: ordenLista, isLoading: isLoadingOrden } = useCollection<OrdenLista>(ordenListaQuery);

  const [localOrdenes, setLocalOrdenes] = useState<Record<string, { orden: number; metodo: string }>>({});

  const tiposUnicos = useMemo(() => {
    if (!listaCompleta) return [];
    const tipos = listaCompleta.map(item => item.tipo).filter(Boolean);
    return Array.from(new Set(tipos));
  }, [listaCompleta]);

  useEffect(() => {
    if (ordenLista) {
      const ordenesMap = ordenLista.reduce((acc, item) => {
        acc[item.tipo] = { orden: item.orden, metodo: item.metodo };
        return acc;
      }, {} as Record<string, { orden: number; metodo: string }>);
      setLocalOrdenes(ordenesMap);
    }
  }, [ordenLista]);

  const handleUpdate = async (tipo: string, field: 'orden' | 'metodo', value: string | number) => {
    if (!firestore || !user) return;
    
    const updatedState = {
      ...localOrdenes,
      [tipo]: {
        ...localOrdenes[tipo],
        [field]: value
      }
    };
    setLocalOrdenes(updatedState);

    const docRef = doc(firestore, 'admins', user.uid, 'orden_lista', tipo);
    const dataToSet = {
        tipo: tipo,
        orden: updatedState[tipo]?.orden ?? 0,
        metodo: updatedState[tipo]?.metodo ?? 'apellidos_asc',
        adminId: user.uid
    };

    try {
      await setDoc(docRef, dataToSet, { merge: true });
      toast({
        title: 'Orden actualizado',
        description: `La configuración para "${tipo}" se ha guardado.`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar la configuración de orden.',
      });
    }
  };


  if (isLoadingLista || isLoadingOrden) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!listaCompleta || listaCompleta.length === 0) {
    return (
        <Alert>
            <ListOrdered className="h-4 w-4" />
            <AlertTitle>No hay datos</AlertTitle>
            <AlertDescription>
                Primero debes agregar un listado de voluntarios para poder configurar el orden.
            </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
        {tiposUnicos.sort((a, b) => (localOrdenes[a]?.orden ?? 99) - (localOrdenes[b]?.orden ?? 99)).map(tipo => (
            <div key={tipo} className="flex items-center gap-2 p-2 border rounded-md">
            <Input
                type="number"
                className="w-16 h-9"
                placeholder="Orden"
                value={localOrdenes[tipo]?.orden ?? ''}
                onChange={(e) => handleUpdate(tipo, 'orden', parseInt(e.target.value, 10) || 0)}
            />
            <span className="flex-1 text-sm font-medium">{tipo}</span>
            <Select
                value={localOrdenes[tipo]?.metodo ?? 'apellidos_asc'}
                onValueChange={(value) => handleUpdate(tipo, 'metodo', value)}
            >
                <SelectTrigger className="w-48 h-9">
                <SelectValue />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="apellidos_asc">Ascendente (Apellidos)</SelectItem>
                <SelectItem value="carga">Orden de Carga</SelectItem>
                <SelectItem value="registro">Número de Registro</SelectItem>
                </SelectContent>
            </Select>
            </div>
        ))}
    </div>
  );
}
