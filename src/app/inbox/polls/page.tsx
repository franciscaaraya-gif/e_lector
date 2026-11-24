'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import Link from 'next/link';

import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Poll, VoterStatus } from '@/lib/types';

import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, CheckCircle2, UserX } from 'lucide-react';
import InboxLoading from './loading';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Solo se muestran votaciones ACTIVAS: el padre ya filtra las pendientes y las cerradas.
function PollInboxItem({ poll, voterStatus, voterId }: { poll: Poll, voterStatus: VoterStatus, voterId: string }) {
    const isEnabled = voterStatus.enabled !== false;

    return (
        <Card className={cn(
            "border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow",
            !isEnabled && "border-l-destructive bg-destructive/5"
        )}>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="truncate text-lg">{poll.question}</CardTitle>
                    {voterStatus.hasVoted && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" /> Votado</Badge>}
                    {!isEnabled && <Badge variant="destructive">Deshabilitado</Badge>}
                </div>
                <CardDescription>
                    {poll.pollType === 'simple' ? 'Selección simple' : `Selección múltiple`}
                </CardDescription>
            </CardHeader>
            <CardFooter>
                {!isEnabled ? (
                    <div className="w-full flex items-center justify-center p-2 text-destructive font-semibold text-sm">
                        Usted está deshabilitado para votar
                    </div>
                ) : voterStatus.hasVoted ? (
                    <Button variant="ghost" className="w-full" disabled>Gracias por votar</Button>
                ) : (
                    <Button asChild className="w-full shadow-md">
                        <Link href={`/vote/${poll.id}?voterId=${voterId}`}>
                            Ir a Votar Ahora
                        </Link>
                    </Button>
                )}
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
    
    const firestore = useFirestore();
    const auth = useAuth();
    const { user, isUserLoading: isAuthLoading } = useUser();

    useEffect(() => {
        if (!auth || isAuthLoading || user) return;
        setIsAuthenticating(true);
        signInAnonymously(auth).finally(() => setIsAuthenticating(false));
    }, [auth, user, isAuthLoading]);

    const votersQuery = useMemoFirebase(() => {
        if (!firestore || !voterId || !salaId || !user) return null;
        return query(
            collectionGroup(firestore, 'voters'),
            where('adminId', '==', salaId),
            where('voterId', '==', voterId)
        );
    }, [firestore, voterId, salaId, user]);

    const { data: voterDocs, isLoading: isDocsLoading } = useCollection<VoterStatus>(votersQuery);

    // Solo las votaciones activas de la sala. Se actualiza sola: cuando el secretario activa
    // o cierra una votación, aparece o desaparece sin recargar.
    const activePollsQuery = useMemoFirebase(() => {
        if (!firestore || !salaId || !user) return null;
        return query(
            collection(firestore, 'admins', salaId, 'polls'),
            where('status', '==', 'active')
        );
    }, [firestore, salaId, user]);

    const { data: activePolls, isLoading: isPollsLoading } = useCollection<Poll>(activePollsQuery);

    // Cada votación activa en la que esta persona está incluida, con su estado de voto.
    const visibleItems = (voterDocs || []).flatMap(voterDoc => {
        const poll = (activePolls || []).find(p => p.id === voterDoc.pollId);
        return poll ? [{ voterDoc, poll }] : [];
    });

    useEffect(() => {
        if (!voterId || !salaId) {
            router.replace('/inbox');
        }
    }, [voterId, salaId, router]);

    const isLoading = isDocsLoading || isPollsLoading || isAuthLoading || isAuthenticating;

    if (isLoading) return <InboxLoading />;
    
    return (
        <div className="w-full space-y-6">
             <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold font-headline">Bandeja de Entrada</h1>
             </div>

            {!voterDocs || voterDocs.length === 0 ? (
                <Card className="text-center p-8 border-dashed border-2 bg-destructive/5 border-destructive/20">
                    <CardContent className="pt-6">
                        <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                             <UserX className="h-8 w-8 text-destructive" />
                        </div>
                        <CardTitle className="mb-2">Acceso Denegado</CardTitle>
                        <p className="text-destructive font-medium text-sm">Usted no está presente en la reunión</p>
                        <p className="text-muted-foreground text-xs mt-4">Si cree que esto es un error, por favor contacte a los oficiales de mesa.</p>
                    </CardContent>
                </Card>
            ) : visibleItems.length === 0 ? (
                <Card className="text-center p-8 border-dashed border-2">
                    <CardContent className="pt-6">
                        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                             <Info className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="mb-2">No hay votaciones activas</CardTitle>
                        <p className="text-muted-foreground text-sm">Cuando se inicie una votación aparecerá aquí automáticamente.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visibleItems.map(({ voterDoc, poll }) => (
                        <PollInboxItem
                            key={voterDoc.id}
                            poll={poll}
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
