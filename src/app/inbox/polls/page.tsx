'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collectionGroup, query, where, getDocs, doc, getDoc, and } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import Link from 'next/link';

import { useAuth, useFirestore, useUser } from '@/firebase';
import { Poll, VoterStatus } from '@/lib/types';

import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import InboxLoading from './loading';


function PollsInboxClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const voterId = searchParams.get('voterId');
    const salaId = searchParams.get('salaId');

    const [polls, setPolls] = useState<Poll[]>([]);
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    const firestore = useFirestore();
    const auth = useAuth();
    const { user, isUserLoading: isAuthLoading } = useUser();

     // Anonymous sign-in effect
    useEffect(() => {
        if (!auth || isAuthLoading || user) return;

        signInAnonymously(auth).catch(err => {
            setError("Se requiere autenticación para ver tus encuestas.");
        });
    }, [auth, user, isAuthLoading]);

    useEffect(() => {
        if (!voterId || !salaId) {
            router.replace('/inbox');
            return;
        }

        if (!firestore || !user || isAuthLoading) {
            return;
        }

        const fetchEligiblePolls = async () => {
            setIsLoading(true);
            setError('');
            try {
                const votersCollectionGroup = collectionGroup(firestore, 'voters');
                // Query for voter documents matching both adminId (salaId) and voterId
                const q = query(votersCollectionGroup, and(
                    where('adminId', '==', salaId),
                    where('voterId', '==', voterId)
                ));
                const querySnapshot = await getDocs(q);

                const eligiblePollPromises = querySnapshot.docs
                    .filter(voterDoc => !(voterDoc.data() as VoterStatus).hasVoted)
                    .map(async (voterDoc) => {
                        const voterData = voterDoc.data() as VoterStatus;
                        // The pollId is in the voter document itself.
                        const pollRef = doc(firestore, 'admins', voterData.adminId, 'polls', voterData.pollId);
                        const pollSnap = await getDoc(pollRef);

                        if (pollSnap.exists() && pollSnap.data().status === 'active') {
                            return { ...pollSnap.data(), id: pollSnap.id } as Poll;
                        }
                        return null;
                    });
                
                const results = (await Promise.all(eligiblePollPromises)).filter((p): p is Poll => p !== null);
                setPolls(results);

            } catch (err: any) {
                console.error(err);
                if (err.code === 'failed-precondition' && err.message.includes('index')) {
                    setError('La base de datos requiere una configuración de índice para esta consulta. Contacta al administrador. Si eres el administrador, el error en la consola del navegador contendrá un enlace para crear el índice requerido.');
                } else if(err.code === 'permission-denied') {
                     setError('Permiso denegado. Verifica que el ID de la sala y tu ID de votante sean correctos.');
                } else {
                    setError('No se pudieron cargar las encuestas. Inténtalo de nuevo más tarde.');
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchEligiblePolls();
    }, [firestore, user, isAuthLoading, voterId, salaId, router]);


    if (isLoading || isAuthLoading) {
        return <InboxLoading />;
    }

    if (error) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Error</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No se pudieron cargar las encuestas</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
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
                <h1 className="text-2xl font-bold font-headline">Tus Encuestas Activas</h1>
                <p className="text-muted-foreground">Sala: <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{salaId}</span></p>
                <p className="text-muted-foreground">ID de Votante: <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{voterId}</span></p>
             </div>

            {polls.length === 0 ? (
                <Card className="text-center p-8">
                    <CardHeader>
                        <CardTitle>¡Todo listo por ahora!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No tienes encuestas pendientes para votar en este momento.</p>
                    </CardContent>
                </Card>
            ) : (
                polls.map(poll => (
                    <Card key={poll.id}>
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
                ))
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
