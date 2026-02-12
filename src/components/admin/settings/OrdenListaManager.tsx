'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, query, doc, writeBatch } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ListaCompletaItem, OrdenLista } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ListOrdered, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const defaultOrderRules: Record<string, { orden: number }> = {
    'martir': { orden: 1 },
    'Director': { orden: 2 },
    'Capitán': { orden: 3 },
    // Los tenientes se agrupan con orden base 4
    'Maquinista': { orden: 7 },
    'Secretario': { orden: 8 },
    'Tesorero': { orden: 9 },
    'Intendente': { orden: 10 },
    'Cirujano': { orden: 11 },
    // Los ayudantes se agrupan con orden base 12
    'Insp. Administración': { orden: 13 },
    'Ayte. Administración': { orden: 14 },
    'Ayte. Comandancia': { orden: 15 },
    'Voluntarios(as)': { orden: 99 },
};

export function OrdenListaManager() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

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
    // Espera a que ambas listas estén cargadas para evitar actualizaciones de estado parciales
    if (isLoadingLista || isLoadingOrden) return;

    const newOrdenes: Record<string, { orden: number; metodo: string }> = {};

    // 1. Construye el estado inicial a partir de todos los 'tipos' únicos encontrados en la lista principal
    tiposUnicos.forEach(tipo => {
        let baseOrder = 99; // Orden por defecto, agrupa con "Voluntarios(as)"
        const defaultRule = defaultOrderRules[tipo];

        if (defaultRule) {
            baseOrder = defaultRule.orden;
        } else if (tipo.startsWith('Teniente')) {
            baseOrder = 4; // Orden base para todos los roles 'Teniente'
        } else if (tipo.startsWith('Ayudante')) {
            baseOrder = 12; // Orden base para todos los roles 'Ayudante'
        }
        
        newOrdenes[tipo] = { orden: baseOrder, metodo: 'apellidos_asc' };
    });

    // 2. Sobrescribe el estado inicial con cualquier orden específico guardado en Firestore.
    // `ordenLista` está garantizado como un array (o vacío) porque isLoadingOrden es false.
    ordenLista?.forEach(item => {
        // Esto asegura que solo usemos órdenes guardadas para tipos que todavía existen.
        if (tiposUnicos.includes(item.tipo)) { 
            newOrdenes[item.tipo] = { orden: item.orden, metodo: item.metodo };
        }
    });

    setLocalOrdenes(newOrdenes);

  }, [isLoadingLista, isLoadingOrden, tiposUnicos, ordenLista]);

  // Only updates local state, does not write to DB
  const handleLocalUpdate = (tipo: string, field: 'orden' | 'metodo', value: string | number) => {
    const updatedState = {
      ...localOrdenes,
      [tipo]: {
        ...(localOrdenes[tipo] ?? { orden: 0, metodo: 'apellidos_asc' }), // Ensure object exists
        [field]: value
      }
    };
    setLocalOrdenes(updatedState);
  };
  
  // Saves all local changes to Firestore
  const handleSaveOrder = async () => {
    if (!firestore || !user) return;
    setIsSaving(true);
    
    try {
        const batch = writeBatch(firestore);
        
        Object.keys(localOrdenes).forEach(tipo => {
            const docRef = doc(firestore, 'admins', user.uid, 'orden_lista', tipo);
            const dataToSet = {
                tipo: tipo,
                orden: localOrdenes[tipo]?.orden ?? 0,
                metodo: localOrdenes[tipo]?.metodo ?? 'apellidos_asc',
                adminId: user.uid
            };
            batch.set(docRef, dataToSet, { merge: true });
        });
        
        await batch.commit();

        toast({
            title: '¡Orden Guardado!',
            description: 'Se ha guardado la nueva configuración de orden para todas las listas.',
        });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: 'No se pudo guardar la configuración de orden.',
      });
    } finally {
        setIsSaving(false);
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

  if (!listaCompleta || tiposUnicos.length === 0) {
    return (
        <Alert>
            <ListOrdered className="h-4 w-4" />
            <AlertTitle>No hay datos para ordenar</AlertTitle>
            <AlertDescription>
                Primero debes agregar un listado de voluntarios para poder configurar el orden.
            </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
        <div className="space-y-3">
            {Object.keys(localOrdenes).sort((a, b) => (localOrdenes[a]?.orden ?? 99) - (localOrdenes[b]?.orden ?? 99)).map(tipo => (
                <div key={tipo} className="flex items-center gap-2 p-2 border rounded-md">
                <Input
                    type="number"
                    className="w-16 h-9"
                    placeholder="Orden"
                    value={localOrdenes[tipo]?.orden ?? ''}
                    onChange={(e) => handleLocalUpdate(tipo, 'orden', parseInt(e.target.value, 10) || 0)}
                />
                <span className="flex-1 text-sm font-medium">{tipo}</span>
                <Select
                    value={localOrdenes[tipo]?.metodo ?? 'apellidos_asc'}
                    onValueChange={(value) => handleLocalUpdate(tipo, 'metodo', value)}
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
        <Button onClick={handleSaveOrder} disabled={isSaving || Object.keys(localOrdenes).length === 0} className="w-full">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Actualizar Orden
        </Button>
    </div>
  );
}
