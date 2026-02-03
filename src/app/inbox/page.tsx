'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { collection } from 'firebase/firestore';
import Link from 'next/link';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Sala } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  salaAdminId: z.string({ required_error: 'Debes seleccionar una sala.' }).min(1, "Debes seleccionar una sala."),
  voterId: z.string().min(1, { message: 'Tu ID de votante es requerido.' }),
});

export default function VoterInboxLoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const firestore = useFirestore();

  const salasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'salas');
  }, [firestore]);
  
  const { data: salas, isLoading: salasLoading, error: salasError } = useCollection<Sala>(salasQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      voterId: '',
      salaAdminId: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const salaAdminId = values.salaAdminId;
    const voterId = values.voterId.trim();
    router.push(`/inbox/polls?salaId=${salaAdminId}&voterId=${voterId}`);
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="salaAdminId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sala de Votación</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una sala" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salasLoading ? (
                          <p className="p-4 text-sm text-muted-foreground text-center">Cargando salas...</p>
                        ) : salas && salas.length > 0 ? (
                          salas.map((sala) => (
                            <SelectItem key={sala.id} value={sala.adminId}>
                              {sala.name}
                            </SelectItem>
                          ))
                        ) : (
                          <p className="p-4 text-sm text-muted-foreground">No hay salas disponibles.</p>
                        )}
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
              <Button type="submit" className="w-full mt-4" disabled={isLoading || !form.formState.isValid}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ver mis encuestas
              </Button>
            </form>
          </Form>
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
