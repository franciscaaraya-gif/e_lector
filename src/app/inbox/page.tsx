
'use client';

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, QrCode } from 'lucide-react';
import { Suspense } from 'react';

function VoterInboxLanding() {
    const searchParams = useSearchParams();
    const salaId = searchParams.get('salaId');

    if (!salaId) {
        return (
            <Card className="shadow-lg border-2 border-dashed">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-headline">Enlace Requerido</CardTitle>
                    <CardDescription>
                        No se ha detectado una sala de votación. Por favor, utiliza el enlace directo proporcionado por el administrador o escanea el código QR oficial.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground italic">
                    El acceso manual a salas ha sido deshabilitado por seguridad.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg">
            <CardHeader className="text-center">
                <QrCode className="mx-auto h-12 w-12 text-primary mb-2" />
                <CardTitle className="text-2xl font-headline">Bandeja de Entrada</CardTitle>
                <CardDescription>
                    Escanea tu tarjeta de identificación o ingresa tu ID para ver las votaciones en la sala <strong>{salaId}</strong>.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action="/inbox/polls" method="GET" className="space-y-4">
                    <input type="hidden" name="salaId" value={salaId} />
                    <div className="space-y-2">
                        <label className="text-sm font-medium">ID de Votante</label>
                        <input 
                            name="voterId"
                            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            placeholder="Escanea o pega tu ID..."
                            autoFocus
                            required
                        />
                    </div>
                    <button type="submit" className="w-full bg-primary text-primary-foreground h-12 rounded-md font-bold shadow-md hover:bg-primary/90 transition-colors">
                        Ver mis votaciones
                    </button>
                </form>
            </CardContent>
        </Card>
    );
}

export default function VoterInboxLoginPage() {
    return (
        <Suspense fallback={<Card className="p-8 text-center">Cargando...</Card>}>
            <VoterInboxLanding />
        </Suspense>
    )
}
