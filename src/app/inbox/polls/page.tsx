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
import { AlertCircle, Info, HelpCircle, ExternalLink } from 'lucide-react';
import InboxLoading from './loading';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
                    {poll.pollType === 'simple' ? 'Selección simple' : `Selección múltiple (máx. ${poll.maxSelections})`}
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

    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    
    const firestore = useFirestore();
    const auth = useAuth();
    const { user, isUserLoading: isAuthLoading } = useUser();

    useEffect(() => {
        if (!auth || isAuthLoading || user) return;

        setIsAuthenticating(true);
        signInAnonymously(auth)
            .catch(err => {
                console.error("Auth error:", err);
            })
            .finally(() => setIsAuthenticating(false));
    }, [auth, user, isAuthLoading]);

    const votersQuery = useMemoFirebase(() => {
        if (!firestore || !voterId || !salaId || !user) return null;
        return query(
            collectionGroup(firestore, 'voters'),
            where('adminId', '==', salaId),
            where('voterId', '==', voterId),
            where('hasVoted', '==', false),
            where('enabled', '==', true)
        );
    }, [firestore, voterId, salaId, user]);

    const { data: voterDocs, isLoading: isDocsLoading, error: docsError } = useCollection<VoterStatus>(votersQuery);

    useEffect(() => {
        if (!voterId || !salaId) {
            router.replace('/inbox');
        }
    }, [voterId, salaId, router]);

    const isLoading = isDocsLoading || isAuthLoading || isAuthenticating;

    if (isLoading) {
        return <InboxLoading />;
    }

    // Extraer link de índice si existe en el error
    const indexLink = docsError?.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
    
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
                        <p className="text-muted-foreground text-sm">No tienes votaciones activas en este momento. Aparecerán aquí automáticamente cuando el administrador inicie una y estés habilitado.</p>
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

            {/* Ayuda técnica para el administrador */}
            {docsError && (
                <div className="pt-8 text-center">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground text-[10px]" 
                        onClick={() => setShowDebug(!showDebug)}
                    >
                        <HelpCircle className="h-3 w-3 mr-1" /> Ayuda técnica (Configuración)
                    </Button>
                    
                    {showDebug && (
                        <Alert variant="destructive" className="mt-4 text-left">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Falta Configuración de Base de Datos</AlertTitle>
                            <AlertDescription className="text-xs space-y-4">
                                <p>Para que la bandeja de entrada funcione, Firebase necesita crear un <strong>Índice Compuesto</strong>.</p>
                                
                                {indexLink ? (
                                    <div className="space-y-2">
                                        <p className="font-bold">Haz clic en el siguiente botón para crearlo automáticamente:</p>
                                        <Button asChild variant="secondary" size="sm" className="w-full">
                                            <a href={indexLink} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="mr-2 h-4 w-4" /> Crear Índice Ahora
                                            </a>
                                        </Button>
                                        <p className="text-[10px] opacity-70 italic">Nota: Una vez que hagas clic, tardará unos 3-5 minutos en activarse.</p>
                                    </div>
                                ) : (
                                    <p>Abre la consola del navegador (F12) para encontrar el enlace de creación automática de Firebase.</p>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
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
