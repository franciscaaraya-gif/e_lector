'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collectionGroup, query, where, doc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import Link from 'next/link';

import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { Poll, VoterStatus } from '@/lib/types';

import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Info, ExternalLink } from 'lucide-react';
import InboxLoading from './loading';

/**
 * Individual Poll item that listens for poll document changes in real-time.
 */
function PollInboxItem({ voterStatus, voterId }: { voterStatus: VoterStatus, voterId: string }) {
    const firestore = useFirestore();
    const pollRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'admins', voterStatus.adminId, 'polls', voterStatus.pollId);
    }, [firestore, voterStatus.adminId, voterStatus.pollId]);

    const { data: poll, isLoading, error } = useDoc<Poll>(pollRef);

    if (isLoading) return <Card className="animate-pulse h-32" />;
    
    if (error || !poll || poll.status !== 'active') return null;

    return (
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle className="truncate text-lg">{poll.question}</CardTitle>
                <CardDescription>
                    {poll.pollType === 'simple' ? 'Selección simple' : `Selección múltiple (hasta ${poll.maxSelections} opciones)`}
                </CardDescription>
            </CardHeader>
            <CardFooter>
                <Button asChild className="w-full">
                    <Link href={`/vote/${poll.id}?voterId=${voterId}`}>
                        Ir a Votar Ahora
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

function PollsInboxClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const voterId = searchParams.get('voterId');
    const salaId = searchParams.get('salaId');

    const [authError, setAuthError] = useState<string>('');
    const firestore = useFirestore();
    const auth = useAuth();
    const { user, isUserLoading: isAuthLoading } = useUser();

    useEffect(() => {
        if (!auth || isAuthLoading || user) return;

        signInAnonymously(auth).catch(err => {
            console.error("Auth error:", err);
            setAuthError("Se requiere autenticación para ver tus votaciones.");
        });
    }, [auth, user, isAuthLoading]);

    const votersQuery = useMemoFirebase(() => {
        if (!firestore || !voterId || !salaId || !user) return null;
        return query(
            collectionGroup(firestore, 'voters'),
            where('adminId', '==', salaId),
            where('voterId', '==', voterId),
            where('hasVoted', '==', false)
        );
    }, [firestore, voterId, salaId, user]);

    const { data: voterDocs, isLoading: isDocsLoading, error: docsError } = useCollection<VoterStatus>(votersQuery);

    useEffect(() => {
        if (!voterId || !salaId) {
            router.replace('/inbox');
        }
    }, [voterId, salaId, router]);

    const isLoading = isDocsLoading || isAuthLoading;

    if (isLoading) {
        return <InboxLoading />;
    }

    if (docsError || authError) {
        return (
             <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertCircle className="h-6 w-6" />
                        Atención Requerida
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm font-medium">No se pueden cargar las votaciones debido a que falta un índice en la base de datos.</p>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                        <h4 className="font-bold text-blue-900 flex items-center gap-2">
                            <Info className="h-4 w-4" /> Pasos para solucionar:
                        </h4>
                        <ol className="text-sm text-blue-800 list-decimal list-inside space-y-2">
                            <li>Presiona la tecla <b>F12</b> de tu teclado.</li>
                            <li>Haz clic en la pestaña que dice <b>"Console"</b> (o Consola).</li>
                            <li>Busca un mensaje en rojo y haz clic en el <b>enlace azul</b> que empieza con <code className="text-[10px] bg-blue-100 px-1">https://console.firebase...</code></li>
                            <li>Se abrirá una ventana de Firebase: haz clic en el botón <b>"Crear índice"</b>.</li>
                            <li>Espera 2-3 minutos y vuelve a esta página.</li>
                        </ol>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button asChild variant="outline" className='w-full'>
                        <Link href="/inbox">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver atrás
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    
    return (
        <div className="w-full space-y-6">
             <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold font-headline">Bandeja de Entrada</h1>
                <div className="flex flex-wrap justify-center gap-2">
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded-full uppercase tracking-wider font-mono">Sala: {salaId}</span>
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded-full uppercase tracking-wider font-mono">ID: {voterId}</span>
                </div>
             </div>

            {!voterDocs || voterDocs.length === 0 ? (
                <Card className="text-center p-8 border-dashed border-2 bg-muted/30">
                    <CardContent className="pt-6">
                        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                             <Info className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="mb-2">Sin votaciones pendientes</CardTitle>
                        <p className="text-muted-foreground text-sm">No tienes votaciones activas en este momento. Cuando se inicie una, aparecerá aquí automáticamente.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {voterDocs.map(voterDoc => (
                        <PollInboxItem 
                            key={voterDoc.id} 
                            voterStatus={voterDoc} 
                            voterId={voterId!} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function PollsInboxPage() {
    return (
        <Suspense fallback={<InboxLoading />}>
            <PollsInboxClient />
        </Suspense>
    )
}