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
import { AlertCircle, ArrowLeft, Info } from 'lucide-react';
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
    
    // If there's an error reading a specific poll, we just don't show it in the list
    if (error || !poll || poll.status !== 'active') return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="truncate">{poll.question}</CardTitle>
                <CardDescription>
                    {poll.pollType === 'simple' ? 'Selección simple' : `Selección múltiple (hasta ${poll.maxSelections} opciones)`}
                </CardDescription>
            </CardHeader>
            <CardFooter>
                <Button asChild className="w-full">
                    <Link href={`/vote/${poll.id}?voterId=${voterId}`}>
                        Ir a Votar
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

     // Anonymous sign-in effect
    useEffect(() => {
        if (!auth || isAuthLoading || user) return;

        signInAnonymously(auth).catch(err => {
            console.error("Auth error:", err);
            setAuthError("Se requiere autenticación para ver tus votaciones.");
        });
    }, [auth, user, isAuthLoading]);

    // Real-time query for voter documents
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
    const error = authError || (docsError ? 'Error de conexión con la base de datos.' : '');

    if (isLoading) {
        return <InboxLoading />;
    }

    if (error) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Bandeja de Entrada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No se pudieron cargar las votaciones</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    
                    <Alert className="bg-blue-50 border-blue-200">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-800">Acción Requerida</AlertTitle>
                        <AlertDescription className="text-blue-700 text-sm">
                            Este error suele ocurrir por falta de un índice en la base de datos.
                            <br /><br />
                            <strong>Para solucionarlo:</strong> Abre la consola de tu navegador (F12), busca el error de Firebase y haz clic en la URL que aparece allí para crear el índice automáticamente en tu panel de control.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                    <Button asChild variant="outline" className='w-full'>
                        <Link href="/inbox">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    
    return (
        <div className="w-full space-y-4">
             <div className="text-center">
                <h1 className="text-2xl font-bold font-headline">Tus Votaciones Activas</h1>
                <p className="text-muted-foreground text-sm">
                    Sala: <span className="font-mono bg-muted px-2 py-0.5 rounded">{salaId}</span>
                </p>
                <p className="text-muted-foreground text-sm">
                    Votante: <span className="font-mono bg-muted px-2 py-0.5 rounded">{voterId}</span>
                </p>
             </div>

            {!voterDocs || voterDocs.length === 0 ? (
                <Card className="text-center p-8">
                    <CardHeader>
                        <CardTitle>¡Todo listo por ahora!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No tienes votaciones pendientes en este momento. Estas aparecerán automáticamente cuando sean activadas.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
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