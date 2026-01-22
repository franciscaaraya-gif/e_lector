'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  pollId: z.string().min(1, { message: 'El ID de la encuesta es requerido.' }),
});

export function UserLoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { pollId: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    const pollId = values.pollId.trim();
    
    if (pollId) {
      router.push(`/vote/${pollId}`);
    } else {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Por favor, ingresa el ID de la encuesta.',
      });
      setIsLoading(false);
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Participar en Encuesta</CardTitle>
        <CardDescription>
            Paso 1: Ingresa el ID de la encuesta que te proporcionaron para continuar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="pollId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID de la Encuesta</FormLabel>
                  <FormControl>
                    <Input placeholder="Pega el ID de la encuesta aquí" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full mt-4" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Siguiente
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
