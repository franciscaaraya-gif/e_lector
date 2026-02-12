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

export function OrdenListaManager() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [numericGroupedTipos, setNumericGroupedTipos] = useState<Set<string>>(new Set());

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
    return Array.from(new Set(listaCompleta.map(item => item.tipo).filter(Boolean)));
  }, [listaCompleta]);

  useEffect(() => {
    if (isLoadingLista || isLoadingOrden) return;

    const newOrdenes: Record<string, { orden: number; metodo: string }> = {};
    
    const cardinalRegex = /(.+?)\s+(primero|segundo|tercero|cuarto|quinto|sexto|séptimo|octavo|noveno|décimo|\d+[ºª°]?)$/i;

    const groupedTipos = new Set<string>();
    const numericGroups = new Set<string>();

    tiposUnicos.forEach(tipo => {
        const match = tipo.match(cardinalRegex);
        if (match && match[1]) {
            const groupName = match[1].trim();
            groupedTipos.add(groupName);
            numericGroups.add(groupName);
        } else {
            groupedTipos.add(tipo);
        }
    });

    setNumericGroupedTipos(numericGroups);

    Array.from(groupedTipos).forEach(tipo => {
        let baseOrder: number;
        const lowerTipo = tipo.toLowerCase();
        let metodo: 'apellidos_asc' | 'carga' | 'registro' | 'jerarquia' = 'apellidos_asc';

        if(numericGroups.has(tipo)) {
            metodo = 'jerarquia';
        } else if (lowerTipo === 'martir '){
            metodo = 'carga';
        }

        // Default order logic
        if (lowerTipo === 'martir ') {
            baseOrder = 1;
        } else if (lowerTipo === 'director') {
            baseOrder = 2;
        } else if (lowerTipo === 'capitán') {
            baseOrder = 3;
        } else if (lowerTipo === 'teniente') {
            baseOrder = 4;
        } else if (lowerTipo === 'ayudante') {
            baseOrder = 5;
        } else if (lowerTipo === 'maquinista') {
            baseOrder = 6;
        } else if (lowerTipo === 'secretario') {
            baseOrder = 7;
        } else if (lowerTipo === 'tesorero') {
            baseOrder = 8;
        } else if (lowerTipo === 'intendente') {
            baseOrder = 9;
        } else if (lowerTipo === 'cirujano') {
            baseOrder = 10;
        } else if (lowerTipo === 'insp. administración') {
            baseOrder = 11;
        } else if (lowerTipo === 'ayte. administración') {
            baseOrder = 12;
        } else if (lowerTipo === 'insp. comandancia') {
            baseOrder = 13;
        } else if (lowerTipo === 'ayte. comandancia') {
            baseOrder = 14;
        } else if (lowerTipo === 'miembro honorario') {
            baseOrder = 15;
        } else if (['activo', 'consejero de disciplina', 'honorario', 'consejero de administración'].includes(lowerTipo)) {
            baseOrder = 16;
        } else {
            baseOrder = 99; // Default for anything else
        }
        
        newOrdenes[tipo] = { orden: baseOrder, metodo: metodo };
    });

    // Override with saved data from Firestore
    ordenLista?.forEach(item => {
        const match = item.tipo.match(cardinalRegex);
        const groupName = match && match[1] ? match[1].trim() : item.tipo;
        
        if (newOrdenes[groupName]) {
            newOrdenes[groupName].orden = item.orden;
            if (!numericGroups.has(groupName) && groupName !== 'Martir ') {
                 newOrdenes[groupName].metodo = item.metodo;
            }
        } else if (newOrdenes[item.tipo]) { 
            newOrdenes[item.tipo].orden = item.orden;
            if (item.tipo !== 'Martir ') {
                 newOrdenes[item.tipo].metodo = item.metodo;
            }
        }
    });

    setLocalOrdenes(newOrdenes);

  }, [isLoadingLista, isLoadingOrden, tiposUnicos, ordenLista]);

  const handleLocalUpdate = (tipo: string, field: 'orden' | 'metodo', value: string | number) => {
    const updatedState = {
      ...localOrdenes,
      [tipo]: {
        ...(localOrdenes[tipo] ?? { orden: 0, metodo: 'apellidos_asc' }),
        [field]: value
      }
    };
    setLocalOrdenes(updatedState);
  };
  
  const handleSaveOrder = async () => {
    if (!firestore || !user) return;
    setIsSaving(true);
    
    try {
        const batch = writeBatch(firestore);
        
        Object.keys(localOrdenes).forEach(tipo => {
            const docRef = doc(firestore, 'admins', user.uid, 'orden_lista', tipo);
            const dataToSet = {
                tipo: tipo,
                orden: localOrdenes[tipo]?.orden ?? 99,
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
            {Object.keys(localOrdenes).sort((a, b) => (localOrdenes[a]?.orden ?? 99) - (localOrdenes[b]?.orden ?? 99)).map(tipo => {
                const isNumericGroup = numericGroupedTipos.has(tipo);
                const isMartir = tipo === 'Martir ';
                return(
                <div key={tipo} className="flex items-center gap-2 p-2 border rounded-md">
                <Input
                    type="number"
                    className="w-16 h-9"
                    placeholder="Orden"
                    value={localOrdenes[tipo]?.orden ?? ''}
                    onChange={(e) => handleLocalUpdate(tipo, 'orden', parseFloat(e.target.value) || 0)}
                />
                <span className="flex-1 text-sm font-medium">{tipo}</span>
                <Select
                    value={localOrdenes[tipo]?.metodo ?? 'apellidos_asc'}
                    onValueChange={(value) => handleLocalUpdate(tipo, 'metodo', value)}
                    disabled={isNumericGroup || isMartir}
                >
                    <SelectTrigger className="w-48 h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {isNumericGroup ? (
                             <SelectItem value="jerarquia">Jerarquía</SelectItem>
                        ): isMartir ? (
                            <SelectItem value="carga">Orden de Carga</SelectItem>
                        ) : (
                            <>
                                <SelectItem value="apellidos_asc">Ascendente (Apellidos)</SelectItem>
                                <SelectItem value="carga">Orden de Carga</SelectItem>
                                <SelectItem value="registro">Número de Registro</SelectItem>
                            </>
                        )}
                    </SelectContent>
                </Select>
                </div>
            )})}
        </div>
        <Button onClick={handleSaveOrder} disabled={isSaving || Object.keys(localOrdenes).length === 0} className="w-full">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Actualizar Orden
        </Button>
    </div>
  );
}
