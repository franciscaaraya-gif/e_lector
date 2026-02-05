'use client';

import { useRouter, useSearchParams } from 'next/navigation';
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
import { Suspense, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  salaId: z.string().min(1, 'Debes seleccionar una sala de votación.'),
  voterId: z.string().min(1, 'Tu ID de votante es requerido.'),
});


function VoterInboxForm() {
    const router = useRouter();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const preselectedSalaId = searchParams.get('salaId');

    const salasQuery = useMemoFirebase(
        () => firestore ? collection(firestore, 'salas') : null,
        [firestore]
    );

    const {
        data: salas,
        isLoading: salasLoading,
        error: salasError,
    } = useCollection<Sala>(salasQuery);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
        salaId: '',
        voterId: '',
        },
    });

    const { setValue } = form;

    useEffect(() => {
        if (preselectedSalaId && salas) {
            setValue('salaId', preselectedSalaId);
        }
    }, [preselectedSalaId, salas, setValue]);


    const {
        formState: { isSubmitting },
    } = form;

    async function onSubmit(values: z.infer<typeof formSchema>) {
        router.push(
        `/inbox/polls?salaId=${values.salaId.trim()}&voterId=${values.voterId.trim()}`
        );
    }
    
    if (!firestore) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                Inicializando conexión…
            </div>
        );
    }

    return (
        <div className="space-y-4">
        <Card className="shadow-lg">
            <CardHeader>
            <CardTitle className="text-2xl font-headline">
                Bandeja de Votación
            </CardTitle>
            <CardDescription>
                Selecciona la sala de votación e ingresa tu ID de votante para ver tus encuestas.
            </CardDescription>
            </CardHeader>

            <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {salasLoading && <p>Cargando salas…</p>}
                {salasError && <p>Error al cargar salas</p>}

                {Array.isArray(salas) && salas.length > 0 && (
                    <FormField
                    control={form.control}
                    name="salaId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Sala de Votación</FormLabel>
                        <Select
                            value={field.value}
                            onValueChange={field.onChange}
                        >
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona una sala" />
                            </SelectTrigger>
                            </FormControl>

                            <SelectContent>
                            {salas.map((sala) => (
                                <SelectItem
                                key={sala.id}
                                value={String(sala.adminId)}
                                >
                                {sala.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="voterId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>ID de Votante</FormLabel>
                        <FormControl>
                        <Input
                            placeholder="Pega tu ID de votante aquí"
                            {...field}
                            disabled={isSubmitting}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <Button
                    type="submit"
                    className="w-full mt-4"
                    disabled={
                    isSubmitting ||
                    salasLoading ||
                    !salas ||
                    salas.length === 0
                    }
                >
                    {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Ver mis encuestas
                </Button>
                </form>
            </Form>
            </CardContent>
        </Card>
        </div>
    );
}

function InboxSuspenseFallback() {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Bandeja de Votación</CardTitle>
          <CardDescription>
            Cargando salas de votación disponibles...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
            </div>
             <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
}

export default function VoterInboxLoginPage() {
    return (
        <Suspense fallback={<InboxSuspenseFallback />}>
            <VoterInboxForm />
        </Suspense>
    )
}
