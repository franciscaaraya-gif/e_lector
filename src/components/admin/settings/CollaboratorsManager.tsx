
'use client';

import { useState } from 'react';
import { collection, query, getDocs, where, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Collaborator } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, Mail } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CollaboratorsManager() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const collabQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'admins', user.uid, 'collaborators');
  }, [firestore, user]);

  const { data: collaborators, isLoading: loadingCollabs } = useCollection<Collaborator>(collabQuery);

  const handleAddCollaborator = async () => {
    if (!firestore || !user || !email.trim()) return;
    setIsLoading(true);

    try {
        // Buscamos si el usuario existe como admin autorizado
        const authQuery = query(collection(firestore, 'authorizedAdmins'), where('email', '==', email.toLowerCase()));
        const authSnap = await getDocs(authQuery);

        if (authSnap.empty) {
            toast({ variant: 'destructive', title: 'Error', description: 'El correo no está en la lista de administradores autorizados.' });
            setIsLoading(false);
            return;
        }

        // Buscamos el UID del usuario (necesitamos que se haya logueado alguna vez o saber su UID)
        // Por simplicidad en este MVP, asumiremos que usamos el email como ID del documento en collaborators
        // Pero lo ideal es buscar el UID del perfil admin.
        const targetEmail = email.toLowerCase();
        
        // Buscamos en la colección /admins para obtener el UID real
        const adminQuery = query(collection(firestore, 'admins'), where('email', '==', targetEmail));
        const adminSnap = await getDocs(adminQuery);

        if (adminSnap.empty) {
            toast({ variant: 'destructive', title: 'Usuario no registrado', description: 'El administrador debe haber iniciado sesión al menos una vez.' });
            setIsLoading(false);
            return;
        }

        const targetUid = adminSnap.docs[0].id;

        await setDoc(doc(firestore, 'admins', user.uid, 'collaborators', targetUid), {
            id: targetUid,
            email: targetEmail,
            addedAt: serverTimestamp()
        });

        toast({ title: 'Colaborador añadido', description: `${targetEmail} ahora puede gestionar esta sala.` });
        setEmail('');
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo añadir al colaborador.' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    if (!firestore || !user) return;
    try {
        await deleteDoc(doc(firestore, 'admins', user.uid, 'collaborators', collabId));
        toast({ title: 'Colaborador eliminado' });
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Correo del administrador..." 
            className="pl-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button onClick={handleAddCollaborator} disabled={isLoading || !email}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          Añadir
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingCollabs ? (
                <TableRow><TableCell colSpan={2} className="text-center">Cargando...</TableCell></TableRow>
            ) : !collaborators || collaborators.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No hay colaboradores añadidos.</TableCell></TableRow>
            ) : (
                collaborators.map(c => (
                    <TableRow key={c.id}>
                        <TableCell>{c.email}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveCollaborator(c.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
