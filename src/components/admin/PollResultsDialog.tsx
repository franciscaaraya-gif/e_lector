'use client';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip
} from "recharts"
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { Poll, Vote } from '@/lib/types';
import { collection } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from "react";
import { Skeleton } from "../ui/skeleton";


interface PollResultsDialogProps {
  poll: Poll;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PollResultsDialog({ poll, open, onOpenChange }: PollResultsDialogProps) {
    const firestore = useFirestore();
    const { user } = useUser();

    const votesRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'admins', user.uid, 'polls', poll.id, 'votes');
    }, [firestore, user, poll.id]);

    const { data: votes, isLoading } = useCollection<Vote>(votesRef);

    const chartData = useMemo(() => {
        if (!votes) return [];

        const results: { [key: string]: number } = poll.options.reduce((acc, option) => {
            acc[option.id] = 0;
            return acc;
        }, {} as { [key: string]: number });

        votes.forEach(vote => {
            vote.selectedOptions.forEach(optionId => {
                if (results[optionId] !== undefined) {
                    results[optionId]++;
                }
            });
        });

        const totalVotes = votes.length > 0 ? votes.map(v => v.selectedOptions.length).reduce((a, b) => a + b, 0) : 0;

        return poll.options.map(option => ({
            name: option.text,
            votes: results[option.id] || 0,
            percentage: totalVotes > 0 ? ((results[option.id] || 0) / totalVotes) * 100 : 0,
        })).sort((a, b) => b.votes - a.votes);
    }, [votes, poll.options]);

    const chartConfig = {
      votes: {
        label: "Votos",
        color: "hsl(var(--primary))",
      },
    }

    const totalVoteCount = useMemo(() => {
        return votes ? votes.length : 0;
    }, [votes]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Resultados de la Encuesta</DialogTitle>
                    <DialogDescription className="truncate">
                       {poll.question}
                    </DialogDescription>
                </DialogHeader>
                <div className="h-80 w-full pt-4 space-y-4">
                 {isLoading && (
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-5/6" />
                        <Skeleton className="h-8 w-3/4" />
                    </div>
                 )}
                 {!isLoading && votes?.length === 0 && <p className="text-center text-muted-foreground pt-16">Aún no hay votos para esta encuesta.</p>}
                 {!isLoading && votes && votes.length > 0 && (
                    <ChartContainer config={chartConfig} className="w-full h-full">
                        <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                             <XAxis type="number" hide />
                             <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                                width={120}
                                />
                            <Tooltip
                                cursor={{ fill: "hsl(var(--muted))" }}
                                content={<ChartTooltipContent 
                                    formatter={(value, name, item) => (
                                        <div className="flex flex-col">
                                            <span>{item.payload.name}</span>
                                            <span className="font-bold">{value} Votos ({item.payload.percentage.toFixed(1)}%)</span>
                                        </div>
                                    )}
                                    hideIndicator
                                    hideLabel 
                                />}
                            />
                            <Bar dataKey="votes" fill="var(--color-votes)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                 )}
                </div>
                 <div className="text-center text-sm text-muted-foreground pt-2">
                    Total de Votantes que han participado: <strong>{totalVoteCount}</strong>
                 </div>
            </DialogContent>
        </Dialog>
    );
}
