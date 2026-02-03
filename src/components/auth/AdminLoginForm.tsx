'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup, OAuthProvider, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore'; 
import { useAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Separator } from '../ui/separator';

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, introduce un correo electrónico válido.' }),
  password: z.string().min(1, { message: 'La contraseña no puede estar vacía.' }),
});

function MicrosoftIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path fill="#f25022" d="M1 1h9v9H1z" />
        <path fill="#00a4ef" d="M1 11h9v9H1z" />
        <path fill="#7fba00" d="M11 1h9v9h-9z" />
        <path fill="#ffb900" d="M11 11h9v9h-9z" />
      </svg>
    );
}

export function AdminLoginForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!auth) {
        toast({
            variant: 'destructive',
            title: 'Error de Firebase',
            description: 'La autenticación no está disponible. Por favor, recarga la página.',
        });
        return;
    }
    
    setIsLoading(true);
    try {
      // Clear any existing session to ensure this one is in-memory
      await signOut(auth);
      await setPersistence(auth, inMemoryPersistence);
      await signInWithEmailAndPassword(auth, values.email, values.password);
      // The AdminLayout component will handle the redirection to the dashboard
      // after the auth state changes.
    } catch (error: any) {
      let description = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = 'El correo electrónico o la contraseña son incorrectos.';
      }
      toast({
        variant: 'destructive',
        title: 'Error al iniciar sesión',
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMicrosoftSignIn = async () => {
    if (!auth || !firestore) {
      toast({
        variant: "destructive",
        title: "Error de configuración",
        description: "Los servicios de autenticación no están listos.",
      });
      return;
    }

    setIsMicrosoftLoading(true);
    try {
      // Clear any existing session to ensure this one is in-memory
      await signOut(auth);
      await setPersistence(auth, inMemoryPersistence);
      const provider = new OAuthProvider('microsoft.com');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email) {
          await signOut(auth);
          toast({
            variant: 'destructive',
            title: 'Error de Cuenta',
            description: 'Tu cuenta de Microsoft no tiene un correo electrónico asociado.'
          });
          setIsMicrosoftLoading(false);
          return;
      }
      
      const userEmail = user.email.toLowerCase();

      // Check if the user's email is in the authorized list
      const authQuery = query(collection(firestore, "authorizedAdmins"), where("email", "==", userEmail));
      const authQuerySnapshot = await getDocs(authQuery);

      if (authQuerySnapshot.empty) {
        // If the user's email is not in the whitelist, they are not authorized.
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Acceso Denegado',
          description: `El correo "${user.email}" no está autorizado. Asegúrate de que el correo en Firestore esté guardado completamente en minúsculas.`
        });
      } else {
          // User is authorized. Now, ensure their admin document exists.
          const adminDocRef = doc(firestore, 'admins', user.uid);
          const adminDocSnap = await getDoc(adminDocRef);

          if (!adminDocSnap.exists()) {
              // First time login for this authorized user, create their admin profile.
              await setDoc(adminDocRef, {
                  id: user.uid,
                  email: user.email,
              });
          }
          // The onAuthStateChanged in AdminLayout will handle the redirect.
      }
    } catch (error: any) {
        let title = 'Error de autenticación';
        let description = 'Ocurrió un error inesperado al intentar iniciar sesión con Microsoft.';
        
        // Handle Firestore "missing index" error
        if (error.code === 'failed-precondition' && error.message.includes('query requires an index')) {
            title = 'Configuración de Base de Datos Requerida';
            description = 'La consulta de autorización falló porque falta un índice en la base de datos. Revisa la consola del navegador (F12) para encontrar un enlace para crearlo.';
        } 
        // Handle existing auth errors
        else if (error.code === 'auth/popup-closed-by-user') {
            description = 'Has cerrado la ventana de inicio de sesión. Por favor, inténtalo de nuevo.';
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            description = 'Ya existe una cuenta con este correo electrónico pero con un método de inicio de sesión diferente.';
        }

        toast({
            variant: 'destructive',
            title: title,
            description,
        });
    } finally {
      setIsMicrosoftLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Acceso de Administrador</CardTitle>
        <CardDescription>Introduce tu correo y contraseña para continuar.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input placeholder="admin@ejemplo.com" {...field} disabled={isLoading || isMicrosoftLoading} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input placeholder="••••••••" {...field} disabled={isLoading || isMicrosoftLoading} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading || isMicrosoftLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar sesión
            </Button>
          </form>
        </Form>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">O</span>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={handleMicrosoftSignIn} disabled={isLoading || isMicrosoftLoading}>
            {isMicrosoftLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <MicrosoftIcon className="mr-2 h-4 w-4" />
            )}
            Continuar con Microsoft
        </Button>
      </CardContent>
    </Card>
  );
}
