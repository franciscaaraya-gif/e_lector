'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Sala } from '@/lib/types';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  salaId: z.string().min(1, 'Debes seleccionar una sala de votación.'),
  voterId: z.string().min(1, 'Tu ID de votante es requerido.'),
});

export default function VoterInboxLoginPage() {
  const router = useRouter();
  const firestore = useFirestore();

  const salasQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'salas');
  }, [firestore]);

  const { data: salas, isLoading: salasLoading, error: salasError } = useCollection<Sala>(salasQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      salaId: '',
      voterId: '',
    },
  });

  const { formState: { isSubmitting } } = form;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // The salaId from the dropdown is the adminId
    router.push(`/inbox/polls?salaId=${values.salaId.trim()}&voterId=${values.voterId.trim()}`);
  }

  const isLoading = isSubmitting;

  return (
    <div className="space-y-4">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Bandeja de Votación</CardTitle>
          <CardDescription>
            Selecciona la sala de votación e ingresa tu ID de votante para ver tus encuestas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="salaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sala de Votación</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={salasLoading || isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una sala" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salasLoading && <SelectItem key="loading" value="loading" disabled>Cargando salas...</SelectItem>}
                        {salasError && <SelectItem key="error" value="error" disabled>Error al cargar salas</SelectItem>}
                        {!salasLoading && !salasError && (!salas || salas.length === 0) && (
                            <SelectItem key="no-salas" value="no-salas" disabled>No hay salas disponibles</SelectItem>
                        )}
                        {!salasLoading && !salasError && salas && salas.map((sala) => (
                          <SelectItem key={sala.id} value={sala.adminId}>
                            {sala.name || sala.adminId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="voterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID de Votante</FormLabel>
                    <FormControl>
                      <Input placeholder="Pega tu ID de votante aquí" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full mt-4" disabled={isLoading || salasLoading || !salas || salas.length === 0}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ver mis encuestas
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
