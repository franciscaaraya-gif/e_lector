
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
import { Info, HelpCircle, Lock, CheckCircle2 } from 'lucide-react';
import InboxLoading from './loading';
import { Badge } from '@/components/ui/badge';

function PollInboxItem({ voterStatus, voterId }: { voterStatus: VoterStatus, voterId: string }) {
    const firestore = useFirestore();
    const pollRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'admins', voterStatus.adminId, 'polls', voterStatus.pollId);
    }, [firestore, voterStatus.adminId, voterStatus.pollId]);

    const { data: poll, isLoading, error } = useDoc<Poll>(pollRef);

    if (isLoading) return <Card className="animate-pulse h-32" />;
    
    // Mostramos la encuesta si está activa o pendiente (pero solo se vota si está activa)
    if (error || !poll || poll.status === 'closed') return null;

    const canVote = poll.status === 'active' && !voterStatus.hasVoted;

    return (
        <Card className={cn(
            "border-l-4 shadow-sm hover:shadow-md transition-shadow",
            poll.status === 'active' ? "border-l-primary" : "border-l-muted opacity-80"
        )}>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="truncate text-lg">{poll.question}</CardTitle>
                    {poll.status === 'pending' && <Badge variant="secondary">Próximamente</Badge>}
                    {voterStatus.hasVoted && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" /> Votado</Badge>}
                </div>
                <CardDescription>
                    {poll.pollType === 'simple' ? 'Selección simple' : `Selección múltiple`}
                </CardDescription>
            </CardHeader>
            <CardFooter>
                {poll.status === 'active' ? (
                    voterStatus.hasVoted ? (
                        <Button variant="ghost" className="w-full" disabled>Gracias por votar</Button>
                    ) : (
                        <Button asChild className="w-full shadow-md">
                            <Link href={`/vote/${poll.id}?voterId=${voterId}`}>
                                Ir a Votar Ahora
                            </Link>
                        </Button>
                    )
                ) : (
                    <Button variant="outline" className="w-full text-muted-foreground" disabled>
                        <Lock className="h-4 w-4 mr-2" /> Votación no iniciada
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

import { cn } from '@/lib/utils';

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
            where('voterId', '==', voterId),
            where('enabled', '==', true)
        );
    }, [firestore, voterId, salaId, user]);

    const { data: voterDocs, isLoading: isDocsLoading } = useCollection<VoterStatus>(votersQuery);

    useEffect(() => {
        if (!voterId || !salaId) {
            router.replace('/inbox');
        }
    }, [voterId, salaId, router]);

    const isLoading = isDocsLoading || isAuthLoading || isAuthenticating;

    if (isLoading) return <InboxLoading />;
    
    return (
        <div className="w-full space-y-6">
             <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold font-headline">Bandeja de Entrada</h1>
                <div className="flex flex-wrap justify-center gap-2">
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded-full uppercase tracking-wider font-mono">ID: {voterId}</span>
                </div>
             </div>

            {!voterDocs || voterDocs.length === 0 ? (
                <Card className="text-center p-8 border-dashed border-2 bg-muted/30">
                    <CardContent className="pt-6">
                        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                             <Info className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="mb-2">Sin votaciones</CardTitle>
                        <p className="text-muted-foreground text-sm">No tienes votaciones pendientes en esta sala.</p>
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
