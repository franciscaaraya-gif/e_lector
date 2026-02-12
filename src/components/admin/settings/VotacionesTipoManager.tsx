'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Trash2, ListChecks } from 'lucide-react';
import { PollTemplate } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  pollType: z.enum(['simple', 'multiple']),
  maxSelections: z.coerce.number().optional(),
}).refine(data => {
    if (data.pollType === 'multiple') {
        return data.maxSelections && data.maxSelections > 1;
    }
    return true;
}, {
    message: 'Para selección múltiple, el máximo de opciones debe ser mayor que 1.',
    path: ['maxSelections'],
});

export function VotacionesTipoManager() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isAdding, setIsAdding] = useState(false);

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'admins', user.uid, 'poll_templates');
  }, [firestore, user]);

  const { data: templates, isLoading } = useCollection<PollTemplate>(templatesQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', pollType: 'simple', maxSelections: undefined },
  });

  const pollType = form.watch('pollType');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return;
    setIsAdding(true);
    
    const dataToSet = {
        ...values,
        adminId: user.uid,
        createdAt: serverTimestamp(),
        maxSelections: values.pollType === 'simple' ? null : values.maxSelections
    };

    try {
      await addDoc(collection(firestore, 'admins', user.uid, 'poll_templates'), dataToSet);
      toast({ title: 'Votación tipo añadida', description: `"${values.name}" se ha añadido a la lista.` });
      form.reset({ name: '', pollType: 'simple', maxSelections: undefined });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo añadir la votación tipo.' });
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(templateId: string, templateName: string) {
    if (!firestore || !user) return;
    try {
      await deleteDoc(doc(firestore, 'admins', user.uid, 'poll_templates', templateId));
      toast({ title: 'Votación tipo eliminada', description: `"${templateName}" se ha eliminado.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la votación tipo.' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium text-sm">Añadir Nueva Votación Tipo</h4>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Oficiales de Comandancia" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
             <FormField control={form.control} name="pollType" render={({ field }) => (
                <FormItem className="space-y-2"><FormLabel>Tipo de Encuesta</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="simple" /></FormControl><FormLabel className="font-normal">Simple</FormLabel></FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="multiple" /></FormControl><FormLabel className="font-normal">Múltiple</FormLabel></FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}/>
            {pollType === 'multiple' && (
                <FormField control={form.control} name="maxSelections" render={({ field }) => (
                    <FormItem><FormLabel>Máximo de Opciones</FormLabel><FormControl><Input type="number" placeholder="Ej: 5" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            )}
            <Button type="submit" disabled={isAdding} className="w-full">
              {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Añadir Votación Tipo
            </Button>
          </form>
        </Form>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm">Votaciones Tipo Existentes</h4>
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {!isLoading && templates && templates.length > 0 && (
          <div className="border rounded-lg">
            <ul className="divide-y">
              {templates.map(template => (
                <li key={template.id} className="flex items-center justify-between p-3">
                    <div>
                        <p className="text-sm font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.pollType === 'simple' ? 'Selección Simple' : `Múltiple (máx. ${template.maxSelections})`}</p>
                    </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(template.id, template.name)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
         {!isLoading && (!templates || templates.length === 0) && (
             <Alert>
                <ListChecks className="h-4 w-4" />
                <AlertTitle>No hay plantillas</AlertTitle>
                <AlertDescription>
                    Aún no has creado votaciones tipo. Usa el formulario de arriba para empezar.
                </AlertDescription>
            </Alert>
         )}
      </div>
    </div>
  );
}
