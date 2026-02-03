'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { collection } from 'firebase/firestore';
import Link from 'next/link';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Sala } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function VoterInboxLoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [salaAdminId, setSalaAdminId] = useState('');
  const [voterId, setVoterId] = useState('');
  const [showError, setShowError] = useState(false);

  const firestore = useFirestore();

  const salasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'salas');
  }, [firestore]);
  
  const { data: salas, isLoading: salasLoading, error: salasError } = useCollection<Sala>(salasQuery);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowError(true);
    if (!salaAdminId || !voterId) return;

    setIsSubmitting(true);
    const id = voterId.trim();
    router.push(`/inbox/polls?salaId=${salaAdminId}&voterId=${id}`);
  }

  const isLoading = salasLoading || isSubmitting;

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Bandeja de Votación</CardTitle>
          <CardDescription>
              Selecciona la sala de votación e ingresa tu ID para ver tus encuestas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sala">Sala de Votación</Label>
              <Select onValueChange={setSalaAdminId} value={salaAdminId} disabled={isLoading}>
                <SelectTrigger id="sala">
                  <SelectValue placeholder="Selecciona una sala" />
                </SelectTrigger>
                <SelectContent>
                  {salasLoading && <SelectItem value="loading" disabled>Cargando salas...</SelectItem>}
                  {salasError && <SelectItem value="error" disabled>Error al cargar salas.</SelectItem>}
                  {!salasLoading && !salasError && salas?.length === 0 && (
                      <SelectItem value="no-salas" disabled>No hay salas disponibles.</SelectItem>
                  )}
                  {salas?.map((sala) => (
                    <SelectItem key={sala.id} value={sala.adminId}>
                      {sala.name || sala.adminId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showError && !salaAdminId && <p className="text-sm font-medium text-destructive">Debes seleccionar una sala.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="voterId">ID de Votante</Label>
              <Input 
                id="voterId"
                placeholder="Pega tu ID de votante aquí" 
                value={voterId}
                onChange={(e) => setVoterId(e.target.value)}
                disabled={isLoading} 
              />
              {showError && !voterId && <p className="text-sm font-medium text-destructive">Tu ID de votante es requerido.</p>}
            </div>

            <Button type="submit" className="w-full mt-4" disabled={isLoading}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ver mis encuestas
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="mt-4 text-center">
        <Button variant="link" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Link>
        </Button>
      </div>
    </>
  );
}
