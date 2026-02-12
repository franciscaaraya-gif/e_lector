'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MartiresManager } from '@/components/admin/settings/MartiresManager';
import { VoluntariosManager } from '@/components/admin/settings/VoluntariosManager';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold tracking-tight font-headline">Configuración de Listas</CardTitle>
        <CardDescription>Administra las listas de personal de la compañía.</CardDescription>
      </CardHeader>
      
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
  );
}
