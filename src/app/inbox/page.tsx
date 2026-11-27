'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Copy, Loader2, MessageCircle, QrCode } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth, useFirestore } from '@/firebase';
import { generateToken, hashToken, linkKey, readStoredLink, saveStoredLink, clearStoredLink } from '@/lib/personal-link';
import { useToast } from '@/hooks/use-toast';

function VoterInboxLanding() {
    const searchParams = useSearchParams();
    const salaId = searchParams.get('salaId');
    const voterIdParam = searchParams.get('voterId');
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();

    const [voterId, setVoterId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [stored, setStored] = useState<{ voterId: string; token: string } | null>(null);
    const [issued, setIssued] = useState<{ voterId: string; token: string } | null>(null);

    useEffect(() => {
        if (voterIdParam) setVoterId(voterIdParam);
    }, [voterIdParam]);

    useEffect(() => {
        if (salaId) setStored(readStoredLink(salaId));
    }, [salaId]);

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

    const personalUrl = (v: { voterId: string; token: string }) =>
        `${window.location.origin}/inbox/polls?salaId=${encodeURIComponent(salaId)}&voterId=${encodeURIComponent(v.voterId)}&t=${v.token}`;

    const handleRetire = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const reg = voterId.trim();
        const key = linkKey(reg);
        if (!firestore || !auth || !key) {
            setError('Escribe tu N° de registro.');
            return;
        }
        setBusy(true);
        try {
            if (!auth.currentUser) await signInAnonymously(auth);
            const token = generateToken();
            const tokenHash = await hashToken(token);
            // Solo se puede crear si aún no existe: la regla rechaza un segundo retiro.
            await setDoc(doc(firestore, 'admins', salaId, 'voterLinks', key), {
                adminId: salaId,
                voterId: reg,
                tokenHash,
                retiradoAt: serverTimestamp(),
            });
            saveStoredLink(salaId, reg, token);
            setStored({ voterId: reg, token });
            setIssued({ voterId: reg, token });
        } catch (err: any) {
            if (err?.code === 'permission-denied') {
                setError('Este enlace ya fue retirado. Si no fuiste tú, avisa al secretario para que lo libere.');
            } else {
                setError('No se pudo retirar el enlace. Revisa tu conexión e inténtalo de nuevo.');
            }
        } finally {
            setBusy(false);
        }
    };

    const copyLink = async (v: { voterId: string; token: string }) => {
        try {
            await navigator.clipboard.writeText(personalUrl(v));
            toast({ title: 'Enlace copiado' });
        } catch {
            toast({ variant: 'destructive', title: 'No se pudo copiar' });
        }
    };

    const whatsappHref = (v: { voterId: string; token: string }) =>
        `https://wa.me/?text=${encodeURIComponent(`Mi enlace personal para votar en E-lector (no lo compartas): ${personalUrl(v)}`)}`;

    // Enlace recién retirado
    if (issued) {
        return (
            <Card className="shadow-lg">
                <CardHeader className="text-center pb-2">
                    <CheckCircle2 className="mx-auto h-14 w-14 text-green-500 mb-2" />
                    <CardTitle className="text-2xl font-headline">¡Listo! Tu enlace está retirado</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <Alert>
                        <AlertTitle className="text-base">Guárdalo para no perderlo</AlertTitle>
                        <AlertDescription className="text-base leading-snug">
                            Toca el botón verde: se abre WhatsApp, elige <b>tu propio nombre</b> (o &quot;Tú&quot;) y envíalo.
                            Así, si se cierra la página, solo abres ese mensaje y tocas el enlace.
                        </AlertDescription>
                    </Alert>
                    <Button asChild size="lg" className="w-full h-16 text-lg font-bold bg-green-600 hover:bg-green-700 text-white">
                        <a href={whatsappHref(issued)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="mr-2 h-6 w-6" /> Enviarme el enlace por WhatsApp
                        </a>
                    </Button>
                    <Button type="button" variant="outline" size="lg" className="w-full h-14 text-base" onClick={() => copyLink(issued)}>
                        <Copy className="mr-2 h-5 w-5" /> Copiar enlace
                    </Button>
                    <Button asChild size="lg" className="w-full h-14 text-base font-bold">
                        <Link href={`/inbox/polls?salaId=${encodeURIComponent(salaId)}&voterId=${encodeURIComponent(issued.voterId)}&t=${issued.token}`}>
                            Entrar a mis votaciones
                        </Link>
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">Es personal: no se lo envíes a nadie.</p>
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
            <CardContent className="pt-4 space-y-6">
                {stored && (
                    <div className="space-y-2">
                        <Button asChild size="lg" className="w-full h-16 text-lg font-bold">
                            <Link href={`/inbox/polls?salaId=${encodeURIComponent(salaId)}&voterId=${encodeURIComponent(stored.voterId)}&t=${stored.token}`}>
                                Continuar a mis votaciones
                            </Link>
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                            Registro {stored.voterId}.{' '}
                            <button type="button" className="underline" onClick={() => { clearStoredLink(salaId); setStored(null); }}>
                                No soy yo
                            </button>
                        </p>
                    </div>
                )}

                {!stored && (
                    <form onSubmit={handleRetire} className="space-y-6">
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
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-sm">{error}</AlertDescription>
                            </Alert>
                        )}
                        <button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground h-14 rounded-md font-bold shadow-md hover:bg-primary/90 transition-colors text-lg disabled:opacity-60 flex items-center justify-center">
                            {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Obtener mi enlace
                        </button>
                        <p className="text-xs text-center text-muted-foreground">
                            El enlace se retira una sola vez y es personal.
                        </p>
                    </form>
                )}
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
