'use client';

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, QrCode } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

function VoterInboxLanding() {
    const searchParams = useSearchParams();
    const salaId = searchParams.get('salaId');
    const voterIdParam = searchParams.get('voterId');
    const [voterId, setVoterId] = useState('');

    useEffect(() => {
        if (voterIdParam) {
            setVoterId(voterIdParam);
        }
    }, [voterIdParam]);

    if (!salaId) {
        return (
            <Card className="shadow-lg border-2 border-dashed">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-headline">Enlace Requerido</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground italic">
                    Por favor, utiliza el enlace directo proporcionado por el administrador o escanea el código QR oficial.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
                <QrCode className="mx-auto h-12 w-12 text-primary mb-2" />
                <CardTitle className="text-2xl font-headline">Bandeja de Entrada</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <form action="/inbox/polls" method="GET" className="space-y-6">
                    <input type="hidden" name="salaId" value={salaId} />
                    <div className="space-y-4">
                        <label className="text-sm font-bold uppercase text-center block leading-tight px-2">
                            INGRESE N° DE REGISTRO<br />
                            <span className="text-[10px] text-muted-foreground font-normal uppercase">
                                (SI NO LO CONOCE CONSULTE A LOS OFICIALES O REVISE EN SU PLACA)
                            </span>
                        </label>
                        <input 
                            name="voterId"
                            value={voterId}
                            onChange={(e) => setVoterId(e.target.value)}
                            className="flex h-14 w-full rounded-md border border-input bg-background px-3 py-2 text-xl font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-center shadow-sm"
                            placeholder="Ej: 12345"
                            autoFocus
                            required
                            autoComplete="off"
                        />
                    </div>
                    <button type="submit" className="w-full bg-primary text-primary-foreground h-14 rounded-md font-bold shadow-md hover:bg-primary/90 transition-colors text-lg">
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
