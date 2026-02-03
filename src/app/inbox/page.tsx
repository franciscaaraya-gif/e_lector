'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Sala } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={salasLoading || isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            salasLoading ? "Cargando salas..." :
                            !salas || salas.length === 0 ? "No hay salas disponibles" :
                            "Selecciona una sala"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salas && salas.map((sala) => (
                          <SelectItem key={sala.id} value={sala.adminId}>
                            {sala.name}
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
      
      {/* Temporal Debug Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Estado de Depuración</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <p><strong>Cargando:</strong> {salasLoading ? 'Sí' : 'No'}</p>
          {salasError && (
            <Alert variant="destructive" className="text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {salasError.message}
              </AlertDescription>
            </Alert>
          )}
          <p><strong>Salas encontradas:</strong> {salas ? salas.length : '0'}</p>
          {salas && salas.length > 0 && (
            <pre className="bg-muted p-2 rounded-md overflow-x-auto">
              {JSON.stringify(salas, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
