'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, getDoc, getDocs, query, where, writeBatch, limit, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ElectorIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { Poll, PollLookup, VoterStatus, VoterGroup } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function VotePageClient() {
    const { pollId } = useParams() as { pollId: string };
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const voterId = searchParams.get('voterId');

    const [poll, setPoll] = useState<Poll | null>(null);
    const [voterDocId, setVoterDocId] = useState<string | null>(null);
    const [adminId, setAdminId] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    const [isFetchingData, setIsFetchingData] = useState(true);

    const firestore = useFirestore();
    const auth = useAuth();
    const { user, isUserLoading: isAuthLoading } = useUser();

    // Anonymous sign-in effect
    useEffect(() => {
        if (!auth || isAuthLoading || user) return;

        signInAnonymously(auth).catch(err => {
            setError("Se requiere autenticación para votar.");
        });
    }, [auth, user, isAuthLoading]);

    // Data fetching effect
    useEffect(() => {
        if (!voterId) {
            // This case is handled by the initial check, but as a safeguard:
            setError("Falta el ID de votante.");
            setIsFetchingData(false);
            return;
        }

        if (!firestore || !pollId || isAuthLoading || !user) {
            return;
        }

        const fetchPollData = async () => {
            setIsFetchingData(true);
            setError('');
            try {
                const lookupSnap = await getDoc(doc(firestore, 'poll-lookup', pollId));
                if (!lookupSnap.exists()) throw new Error('Encuesta no encontrada o inválida.');
                const adminId = (lookupSnap.data() as PollLookup).adminId;
                setAdminId(adminId);

                const pollSnap = await getDoc(doc(firestore, 'admins', adminId, 'polls', pollId));
                if (!pollSnap.exists()) throw new Error('Encuesta no encontrada o inválida.');
                
                const pollData = { id: pollSnap.id, ...pollSnap.data() } as Poll;
                if (pollData.status !== 'active') throw new Error('Esta encuesta no se encuentra activa en este momento.');

                // Check if the voter is enabled in the source group
                const groupRef = doc(firestore, 'admins', adminId, 'groups', pollData.groupId);
                const groupSnap = await getDoc(groupRef);
                if (!groupSnap.exists()) throw new Error('El grupo de votantes asociado a esta encuesta no fue encontrado.');
                
                const groupData = groupSnap.data() as VoterGroup;
                const voterInfo = groupData.voters.find(v => v.id === voterId);

                if (!voterInfo || voterInfo.enabled === false) {
                    throw new Error('No tienes permitido votar en esta encuesta.');
                }

                setPoll(pollData);

                const votersRef = collection(firestore, 'admins', adminId, 'polls', pollId, 'voters');
                const q = query(votersRef, where('voterId', '==', voterId), limit(1));
                const voterSnap = await getDocs(q);

                if (voterSnap.empty) throw new Error('No eres elegible para votar en esta encuesta, o tu ID de votante es incorrecto.');

                const voterDoc = voterSnap.docs[0];
                if ((voterDoc.data() as VoterStatus).hasVoted) throw new Error('Ya has emitido tu voto para esta encuesta.');

                setVoterDocId(voterDoc.id);

            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsFetchingData(false);
            }
        };

        fetchPollData();
    }, [firestore, user, isAuthLoading, pollId, voterId]);

    // Dynamic Zod schema based on poll type
    const formSchema = z.object({
        selectedOptions: poll?.pollType === 'simple'
            ? z.string({ required_error: "Debes seleccionar una opción." })
            : z.array(z.string()).min(1, "Debes seleccionar al menos una opción.").max(poll?.maxSelections || poll?.options.length || 0, `Puedes seleccionar como máximo ${poll?.maxSelections} opciones.`)
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            selectedOptions: poll?.pollType === 'simple' ? undefined : [],
        },
    });

    const { formState: { isSubmitting } } = form;

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!firestore || !poll || !adminId || !voterDocId) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el voto. Faltan datos.' });
            return;
        }

        try {
            const batch = writeBatch(firestore);

            const votesRef = collection(firestore, 'admins', adminId, 'polls', pollId, 'votes');
            const newVoteRef = doc(votesRef);
            batch.set(newVoteRef, {
                pollId: poll.id,
                adminId: adminId,
                selectedOptions: Array.isArray(values.selectedOptions) ? values.selectedOptions : [values.selectedOptions],
                createdAt: serverTimestamp(),
            });

            const voterRef = doc(firestore, 'admins', adminId, 'polls', pollId, 'voters', voterDocId);
            batch.update(voterRef, { hasVoted: true });
            
            await batch.commit();

            router.push(`/vote/success?voterId=${voterId}&salaId=${adminId}`);

        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error al emitir el voto', description: err.message });
        }
    }
    
    const headerContent = (
        <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center justify-center gap-2" prefetch={false}>
                <ElectorIcon className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold tracking-tight text-primary font-headline">E-lector</span>
            </Link>
        </div>
    );
    
    const pageLayout = (content: React.ReactNode) => (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-2xl">
                {headerContent}
                {content}
            </div>
        </div>
    );
    
    // Step 1: Handle missing voterId
    if (!voterId) {
        return pageLayout(
             <Card>
                <CardHeader>
                    <CardTitle>Falta el ID de votante</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Parámetro no encontrado</AlertTitle>
                        <AlertDescription>
                            Para votar, tu ID de votante debe estar incluido en el enlace. Por favor, accede a través de tu bandeja de entrada.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                   <Button asChild variant="outline" className='w-full'>
                        <Link href="/inbox">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Ir a la Bandeja de Entrada
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    // Step 2: Handle loading state while fetching data
    if (isAuthLoading || isFetchingData) {
        return pageLayout(<LoadingSkeleton />);
    }
    
    // Step 3: Handle errors
    if (error) {
        return pageLayout(
            <Card>
                <CardHeader>
                    <CardTitle>No se puede votar</CardTitle>
                    <CardDescription>
                        Ha ocurrido un problema al intentar cargar la encuesta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                   <Button asChild variant="outline" className='w-full'>
                        <Link href="/inbox">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a la bandeja de entrada
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    
    // Step 4: Handle case where poll data couldn't be fetched
    if (!poll) {
        return pageLayout(<LoadingSkeleton />); // Or a more specific error
    }

    // Step 5: Show the actual voting form
    return pageLayout(
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="text-2xl">{poll.question}</CardTitle>
                        <CardDescription>
                            {poll.pollType === 'simple'
                                ? 'Selecciona una opción.'
                                : `Puedes seleccionar hasta ${poll.maxSelections} opciones.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="selectedOptions"
                            render={({ field }) => (
                                <FormItem>
                                    {poll.pollType === 'simple' ? (
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value as string} className="space-y-2">
                                                {poll.options.map((option) => (
                                                    <FormItem key={option.id} className="flex items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground">
                                                        <FormControl>
                                                            <RadioGroupItem value={String(option.id)} />
                                                        </FormControl>
                                                        <FormLabel className="font-normal flex-1 cursor-pointer">{option.text}</FormLabel>
                                                    </FormItem>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                    ) : (
                                        <div className="space-y-2">
                                            {poll.options.map((option) => (
                                                <FormField
                                                    key={option.id}
                                                    control={form.control}
                                                    name="selectedOptions"
                                                    render={({ field }) => (
                                                        <FormItem
                                                            key={option.id}
                                                            className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent hover:text-accent-foreground has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground"
                                                        >
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={Array.isArray(field.value) && field.value.includes(String(option.id))}
                                                                    onCheckedChange={(checked) => {
                                                                        const currentValue = (field.value ?? []) as string[];
                                                                        return checked
                                                                            ? field.onChange([...currentValue, String(option.id)])
                                                                            : field.onChange(currentValue.filter((value) => value !== String(option.id)));
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal flex-1 cursor-pointer">{option.text}</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <FormMessage className="pt-2" />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Emitir Voto
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}

function LoadingSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
            </CardContent>
             <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    );
}

export default function VotePage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VotePageClient />
    </Suspense>
  );
}
