'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }).max(50, { message: 'El nombre no puede tener más de 50 caracteres.' }),
});

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return;

    setIsLoading(true);
    const newGroupData = {
      name: values.name,
      adminId: user.uid,
      voters: [], // Se crea vacío para enrolar gente después
      createdAt: serverTimestamp()
    };
    
    const groupsCollection = collection(firestore, 'admins', user.uid, 'groups');

    try {
      await addDoc(groupsCollection, newGroupData);
      toast({ 
        title: '¡Grupo Creado!', 
        description: `El grupo "${values.name}" se creó correctamente. Ahora puedes agregar votantes.` 
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: groupsCollection.path, 
        operation: 'create', 
        requestResourceData: newGroupData 
      }));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) form.reset(); }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" />Crear Grupo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Grupo</DialogTitle>
          <DialogDescription>
            Ingresa un nombre para el grupo. Una vez creado, podrás agregar a los votantes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Grupo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Junta Extraordinaria 2024" {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Grupo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
