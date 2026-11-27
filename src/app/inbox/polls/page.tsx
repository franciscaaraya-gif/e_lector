'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import Link from 'next/link';

import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Poll, VoterStatus } from '@/lib/types';
import { verifyPersonalToken, readStoredLink } from '@/lib/personal-link';

import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, CheckCircle2, UserX, KeyRound } from 'lucide-react';
import InboxLoading from './loading';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Solo se muestran votaciones ACTIVAS: el padre ya filtra las pendientes y las cerradas.
function PollInboxItem({ poll, voterStatus, voterId, token }: { poll: Poll, voterStatus: VoterStatus, voterId: string, token: string }) {
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
                        <Link href={`/vote/${poll.id}?voterId=${encodeURIComponent(voterId)}&t=${token}`}>
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
    // El código del enlace personal viene en la URL; si falta, se usa el guardado en este teléfono.
    const [token, setToken] = useState<string | null>(searchParams.get('t'));
    // null = verificando, true = enlace válido, false = no válido
    const [linkOk, setLinkOk] = useState<boolean | null>(null);

    const [isAuthenticating, setIsAuthenticating] = useState(false);
    
    const firestore = useFirestore();
    const auth = useAuth();
    const { user, isUserLoading: isAuthLoading } = useUser();

    useEffect(() => {
        if (!auth || isAuthLoading || user) return;
        setIsAuthenticating(true);
        signInAnonymously(auth).finally(() => setIsAuthenticating(false));
    }, [auth, user, isAuthLoading]);

    useEffect(() => {
        if (!firestore || !user || !voterId || !salaId) return;
        let cancelled = false;
        let t = token;
        if (!t) {
            const stored = readStoredLink(salaId);
            if (stored && stored.voterId === voterId) { t = stored.token; setToken(t); }
        }
        setLinkOk(null);
        verifyPersonalToken(firestore, salaId, voterId, t)
            .then(ok => { if (!cancelled) setLinkOk(ok); })
            .catch(() => { if (!cancelled) setLinkOk(false); });
        return () => { cancelled = true; };
    }, [firestore, user, voterId, salaId, token]);

    const votersQuery = useMemoFirebase(() => {
        if (!firestore || !voterId || !salaId || !user || linkOk !== true) return null;
        return query(
            collectionGroup(firestore, 'voters'),
            where('adminId', '==', salaId),
            where('voterId', '==', voterId)
        );
    }, [firestore, voterId, salaId, user, linkOk]);

    const { data: voterDocs, isLoading: isDocsLoading } = useCollection<VoterStatus>(votersQuery);

    // Solo las votaciones activas de la sala. Se actualiza sola: cuando el secretario activa
    // o cierra una votación, aparece o desaparece sin recargar.
    const activePollsQuery = useMemoFirebase(() => {
        if (!firestore || !salaId || !user || linkOk !== true) return null;
        return query(
            collection(firestore, 'admins', salaId, 'polls'),
            where('status', '==', 'active')
        );
    }, [firestore, salaId, user, linkOk]);

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

    const isLoading = linkOk === null || (linkOk === true && (isDocsLoading || isPollsLoading)) || isAuthLoading || isAuthenticating;

    if (isLoading) return <InboxLoading />;

    if (linkOk === false) {
        return (
            <div className="w-full space-y-6">
                <Card className="text-center p-8 border-dashed border-2 bg-destructive/5 border-destructive/20">
                    <CardContent className="pt-6 space-y-4">
                        <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                            <KeyRound className="h-8 w-8 text-destructive" />
                        </div>
                        <CardTitle>Enlace no válido</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Necesitas tu enlace personal para votar. Si aún no lo retiras, hazlo con tu N° de registro.
                            Si ya lo retiraste y no te funciona, avisa al secretario para que lo libere.
                        </p>
                        <Button asChild size="lg" className="w-full font-bold">
                            <Link href={`/inbox?salaId=${encodeURIComponent(salaId || '')}`}>Retirar mi enlace</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
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
                            token={token!}
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
