'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MartiresManager } from '@/components/admin/settings/MartiresManager';
import { VoluntariosManager } from '@/components/admin/settings/VoluntariosManager';
import { OrdenListaManager } from '@/components/admin/settings/OrdenListaManager';
import { VotacionesTipoManager } from '@/components/admin/settings/VotacionesTipoManager';
import { CollaboratorsManager } from '@/components/admin/settings/CollaboratorsManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Admin } from '@/lib/types';
import SettingsLoading from './loading';

export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('listas');

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
        <CardDescription>Administra la sala, el personal y los colaboradores.</CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="listas" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="listas">Personal</TabsTrigger>
            <TabsTrigger value="votaciones">Plantillas</TabsTrigger>
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
        </TabsList>

        <TabsContent value="listas" className="mt-6 space-y-6">
            {activeTab === 'listas' && (
                isBombero ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-6">
                      <Card>
                          <CardHeader>
                          <CardTitle>Mártires</CardTitle>
                          </CardHeader>
                          <CardContent>
                          <MartiresManager />
                          </CardContent>
                      </Card>
                      
                      <Card>
                          <CardHeader>
                          <CardTitle>Voluntarios y RFID</CardTitle>
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
                          </CardHeader>
                          <CardContent>
                          <OrdenListaManager />
                          </CardContent>
                      </Card>
                      </div>
                  </div>
                ) : (
                  <Card>
                      <CardHeader><CardTitle>Voluntarios</CardTitle></CardHeader>
                      <CardContent><VoluntariosManager /></CardContent>
                  </Card>
                )
            )}
        </TabsContent>

        <TabsContent value="votaciones" className="mt-6">
            {activeTab === 'votaciones' && (
                <Card>
                    <CardHeader><CardTitle>Votaciones Tipo</CardTitle></CardHeader>
                    <CardContent><VotacionesTipoManager /></CardContent>
                </Card>
            )}
        </TabsContent>

        <TabsContent value="colaboradores" className="mt-6">
            {activeTab === 'colaboradores' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Gestión de Colaboradores</CardTitle>
                        <CardDescription>Permite que otros administradores gestionen esta sala.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CollaboratorsManager />
                    </CardContent>
                </Card>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}