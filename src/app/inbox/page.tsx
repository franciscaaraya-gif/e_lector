'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  salaId: z.string().min(1, 'El ID de la sala es requerido.'),
  voterId: z.string().min(1, 'Tu ID de votante es requerido.'),
});

export default function VoterInboxLoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      salaId: '',
      voterId: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    // The salaId is the adminId
    router.push(`/inbox/polls?salaId=${values.salaId.trim()}&voterId=${values.voterId.trim()}`);
  }
  
  const isLoading = isSubmitting;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Bandeja de Votación</CardTitle>
        <CardDescription>
            Ingresa el ID de la sala de votación y tu ID de votante para ver tus encuestas.
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
                  <FormLabel>ID de la Sala</FormLabel>
                  <FormControl>
                    <Input id="salaId" placeholder="ID de la sala del administrador" {...field} disabled={isLoading} />
                  </FormControl>
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
                    <Input id="voterId" placeholder="Pega tu ID de votante aquí" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full mt-4" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ver mis encuestas
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
