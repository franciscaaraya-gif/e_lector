import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function PollDetailsPage() {
  return (
    <Card>
        <CardHeader>
            <CardTitle>Funcionalidad Deshabilitada</CardTitle>
            <CardDescription>La funcionalidad de detalles de encuesta ha sido deshabilitada al eliminar Firebase.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild>
                <Link href="/admin/dashboard">Volver al panel</Link>
            </Button>
        </CardContent>
    </Card>
  );
}
