'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, UserX, X } from 'lucide-react';
import { ListaCompletaItem } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  fullName: z.string().min(5, 'El nombre completo debe tener al menos 5 caracteres.'),
});

export function MartiresManager() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isAdding, setIsAdding] = useState(false);

  const martiresQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'admins', user.uid, 'lista_completa'),
      where('tipo', '==', 'Martir ')
    );
  }, [firestore, user]);

  const { data: martires, isLoading } = useCollection<ListaCompletaItem>(martiresQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return;
    setIsAdding(true);

    const nameParts = values.fullName.trim().split(' ');
    const apellidos = nameParts.pop() || '';
    const nombres = nameParts.join(' ');
    
    try {
      await addDoc(collection(firestore, 'admins', user.uid, 'lista_completa'), {
        adminId: user.uid,
        nombres: nombres || apellidos, 
        apellidos: nombres ? apellidos : '',
        tipo: 'Martir ',
      });
      toast({ title: 'Mártir añadido', description: `"${values.fullName}" se ha añadido a la lista.` });
      form.reset();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo añadir el mártir.' });
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(martirId: string, martirName: string) {
    if (!firestore || !user) return;
    try {
      await deleteDoc(doc(firestore, 'admins', user.uid, 'lista_completa', martirId));
      toast({ title: 'Mártir eliminado', description: `"${martirName}" se ha eliminado de la lista.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el mártir.' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Lista de Mártires</h4>
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {!isLoading && martires && martires.length > 0 && (
          <div className="border rounded-lg">
            <ul className="divide-y">
              {martires.map(martir => (
                <li key={martir.id} className="flex items-center justify-between p-3">
                  <span className="text-sm">{martir.nombres} {martir.apellidos}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(martir.id, `${martir.nombres} ${martir.apellidos}`)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
         {!isLoading && (!martires || martires.length === 0) && (
            <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg p-8">
                <UserX className="h-8 w-8 mb-2" />
                <p>No hay mártires en la lista.</p>
                <p>Añade uno usando el formulario de abajo.</p>
            </div>
         )}
      </div>
      <div className="border rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-sm">Añadir Mártir</h4>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="Nombres y Apellidos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isAdding}>
              {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Añadir
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
