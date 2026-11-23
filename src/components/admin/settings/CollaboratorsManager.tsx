
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
    const typed = email.trim();
    if (!firestore || !user || !typed) return;
    setIsLoading(true);

    const targetEmail = typed.toLowerCase();
    // El correo guardado puede tener mayúsculas distintas según lo entregue Microsoft
    const variants = Array.from(new Set([targetEmail, typed]));

    try {
        // 1) Debe estar en la lista de administradores autorizados
        const authSnap = await getDocs(query(collection(firestore, 'authorizedAdmins'), where('email', 'in', variants)));
        if (authSnap.empty) {
            toast({ variant: 'destructive', title: 'Correo no autorizado', description: 'Ese correo no está en la lista de administradores autorizados.' });
            return;
        }

        // 2) Debe haber iniciado sesión al menos una vez (ahí se crea su perfil con su UID)
        const adminSnap = await getDocs(query(collection(firestore, 'admins'), where('email', 'in', variants)));
        if (adminSnap.empty) {
            toast({ variant: 'destructive', title: 'Aún no ha ingresado', description: 'Esa persona debe iniciar sesión en E-lector al menos una vez para poder añadirla.' });
            return;
        }

        const targetUid = adminSnap.docs[0].id;
        if (targetUid === user.uid) {
            toast({ variant: 'destructive', title: 'Ese eres tú', description: 'Ya eres el administrador de esta sala.' });
            return;
        }

        await setDoc(doc(firestore, 'admins', user.uid, 'collaborators', targetUid), {
            id: targetUid,
            email: targetEmail,
            addedAt: serverTimestamp()
        });

        toast({ title: 'Colaborador añadido', description: `${targetEmail} ahora puede gestionar esta sala.` });
        setEmail('');
    } catch (e: any) {
        console.error('Error al añadir colaborador:', e);
        const denied = e?.code === 'permission-denied';
        toast({
            variant: 'destructive',
            title: 'No se pudo añadir al colaborador',
            description: denied
                ? 'Permiso denegado por las reglas de Firestore. Hay que publicar las reglas actualizadas (firestore.rules).'
                : `Error: ${e?.code || e?.message || 'desconocido'}`
        });
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
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCollaborator(); }}
            type="email"
            autoCapitalize="none"
            autoComplete="off"
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
