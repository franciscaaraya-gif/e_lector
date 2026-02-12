'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MartiresManager } from '@/components/admin/settings/MartiresManager';
import { VoluntariosManager } from '@/components/admin/settings/VoluntariosManager';
import { OrdenListaManager } from '@/components/admin/settings/OrdenListaManager';
import { VotacionesTipoManager } from '@/components/admin/settings/VotacionesTipoManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Admin } from '@/lib/types';
import SettingsLoading from './loading';

export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const adminDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'admins', user.uid);
  }, [user, firestore]);

  const { data: admin, isLoading: isAdminLoading } = useDoc<Admin>(adminDocRef);

  const isLoading = isUserLoading || isAdminLoading;
  const isBombero = admin?.isBombero === true;

  if (isLoading) {
    return <SettingsLoading />;
  }

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold tracking-tight font-headline">Configuración</CardTitle>
        <CardDescription>Administra las listas de personal, el orden de las listas y las votaciones tipo.</CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="listas">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="listas">Listas y Personal</TabsTrigger>
            <TabsTrigger value="votaciones">Votaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="listas" className="mt-6">
            {isBombero ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                  <Card>
                      <CardHeader>
                      <CardTitle>Mártires</CardTitle>
                      <CardDescription>Añade o elimina mártires de la lista de honor.</CardDescription>
                      </CardHeader>
                      <CardContent>
                      <MartiresManager />
                      </CardContent>
                  </Card>
                  
                  <Card>
                      <CardHeader>
                      <CardTitle>Voluntarios</CardTitle>
                      <CardDescription>Carga la lista completa de voluntarios desde un archivo Excel y visualiza los bomberos activos.</CardDescription>
                      </CardHeader>
                      <CardContent>
                      <VoluntariosManager />
                      </CardContent>
                  </Card>
                  </div>

                  <div className="space-y-6">
                  <Card>
                      <CardHeader>
                      <CardTitle>Orden de Lista</CardTitle>
                      <CardDescription>Define la prioridad y el método de ordenamiento para cada tipo de personal al pasar lista.</CardDescription>
                      </CardHeader>
                      <CardContent>
                      <OrdenListaManager />
                      </CardContent>
                  </Card>
                  </div>
              </div>
            ) : (
              <Card>
                  <CardHeader>
                    <CardTitle>Voluntarios</CardTitle>
                    <CardDescription>Carga la lista completa de voluntarios desde un archivo Excel y visualiza los bomberos activos.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <VoluntariosManager />
                  </CardContent>
              </Card>
            )}
        </TabsContent>
        <TabsContent value="votaciones" className="mt-6">
            <Card>
                <CardHeader>
                <CardTitle>Votaciones Tipo</CardTitle>
                <CardDescription>Crea plantillas para votaciones estándar y reutilizables.</CardDescription>
                </CardHeader>
                <CardContent>
                <VotacionesTipoManager />
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

    