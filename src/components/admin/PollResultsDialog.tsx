'use client';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts"
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { Poll, Vote, VoterStatus } from '@/lib/types';
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Separator } from "../ui/separator";
import { Info, UserCheck, UserX, Vote as VoteIcon, Clock, Users, Download, ChevronDown, ShieldCheck, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, sortPeople, formatFullName } from "@/lib/utils";

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

    const votersRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'admins', user.uid, 'polls', poll.id, 'voters');
    }, [firestore, user, poll.id]);

    const { data: votes, isLoading: votesLoading } = useCollection<Vote>(votesRef);
    const { data: votersStatus, isLoading: votersStatusLoading } = useCollection<VoterStatus>(votersRef);

    const isLoading = votesLoading || votersStatusLoading;

    const stats = useMemo(() => {
        if (!votersStatus || !votes) return null;

        const universe = votersStatus.length;
        const enabled = votersStatus.filter(v => v.enabled !== false).length;
        const disabled = universe - enabled;
        const cast = votes.length;
        const notVoted = enabled - cast;
        const participation = enabled > 0 ? (cast / enabled) * 100 : 0;

        const salaCuadra = universe === (enabled + disabled);
        const participaciónCuadra = enabled === (cast + notVoted);

        return { universe, enabled, disabled, cast, notVoted, participation, salaCuadra, participaciónCuadra };
    }, [votersStatus, votes]);

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

        const totalVotes = votes.length;

        return poll.options.map(option => {
            const count = results[option.id] || 0;
            const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            return {
                name: option.text,
                votes: count,
                percentage: percentage,
                displayLabel: `${count} (${percentage.toFixed(1)}%)`,
            };
        }).sort((a, b) => b.votes - a.votes);
    }, [votes, poll.options]);

    const sortedVotersStatus = useMemo(() => {
        return sortPeople(votersStatus, (v) => ({ nombres: v.nombre, apellidos: v.apellido }));
    }, [votersStatus]);

    const generatePDF = (isDetailed: boolean) => {
        if (!stats || !sortedVotersStatus) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(18);
        doc.text("INFORME DE VOTACIÓN E-LECTOR", pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`Pregunta: ${poll.question}`, 20, 35);
        doc.text(`Estado: ${poll.status === 'closed' ? 'Cerrada' : 'Finalizada'}`, 20, 42);
        doc.text(`Fecha Apertura: ${poll.activatedAt ? format(poll.activatedAt.toDate(), "d MMM yyyy, HH:mm", { locale: es }) : "N/A"}`, 20, 49);
        doc.text(`Fecha Cierre: ${poll.closedAt ? format(poll.closedAt.toDate(), "d MMM yyyy, HH:mm", { locale: es }) : "N/A"}`, 20, 56);

        doc.setFontSize(14);
        doc.text("Resumen de Participación", 20, 70);
        autoTable(doc, {
            startY: 75,
            head: [['En Sala', 'Con Derecho', 'No Habil.', 'Votaron', 'No Votaron', 'Part. Real']],
            body: [[
                stats.universe, 
                stats.enabled, 
                stats.disabled, 
                stats.cast, 
                stats.notVoted,
                `${stats.participation.toFixed(1)}%`
            ]],
            theme: 'grid',
            headStyles: { fillColor: [37, 56, 118] }
        });

        const finalYStats = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Cuadratura Sala: ${stats.universe} (Sala) = ${stats.enabled} (Habilitados) + ${stats.disabled} (No Habilitados)`, 20, finalYStats + 10);
        doc.text(`Cuadratura Voto: ${stats.enabled} (Derecho) = ${stats.cast} (Votaron) + ${stats.notVoted} (No Votaron)`, 20, finalYStats + 16);
        
        if (stats.notVoted > 0) {
            doc.setTextColor(200, 100, 0);
            doc.text(`${stats.notVoted} voluntarios habilitados no votaron.`, 20, finalYStats + 22);
        } else {
            doc.setTextColor(0, 150, 0);
            doc.text(`Todos los habilitados votaron.`, 20, finalYStats + 22);
        }
        doc.setTextColor(0);

        doc.setFontSize(14);
        doc.text("Resultados por Opción", 20, finalYStats + 35);
        autoTable(doc, {
            startY: finalYStats + 40,
            head: [['Opción', 'Votos Recibidos', 'Porcentaje']],
            body: chartData.map(item => [item.name, item.votes, `${item.percentage.toFixed(1)}%`]),
            theme: 'striped',
            headStyles: { fillColor: [37, 56, 118] }
        });

        if (isDetailed) {
            doc.addPage();
            doc.setFontSize(16);
            doc.text("Anexo de Auditoría: Registro de Votantes", 20, 20);
            autoTable(doc, {
                startY: 25,
                head: [['Nombre Completo', 'Habilitación', '¿Votó?']],
                body: sortedVotersStatus.map(v => [
                    formatFullName(v.nombre, v.apellido), 
                    v.enabled !== false ? 'Habilitado' : 'No Habilitado',
                    v.hasVoted ? 'SÍ' : 'NO'
                ]),
                theme: 'grid',
                headStyles: { fillColor: [100, 100, 100] }
            });
        }

        const fileName = isDetailed ? `Informe_Detallado_${poll.id}.pdf` : `Informe_Simple_${poll.id}.pdf`;
        doc.save(fileName);
    };

    const chartConfig = {
      votes: {
        label: "Votos",
        color: "hsl(var(--primary))",
      },
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[95dvh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-start justify-between gap-4 pr-8">
                    <div className="space-y-1">
                        <DialogTitle className="text-xl">Informe de Votación</DialogTitle>
                        <DialogDescription className="text-primary font-medium">
                           {poll.question}
                        </DialogDescription>
                    </div>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="shrink-0" disabled={isLoading}>
                                <Download className="mr-2 h-4 w-4" /> Descargar PDF <ChevronDown className="ml-2 h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => generatePDF(false)}>
                                Informe Simple (Solo resultados)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generatePDF(true)}>
                                Informe Detallado (Auditoría)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Inicio</span>
                                <span className="text-sm">{poll.activatedAt ? format(poll.activatedAt.toDate(), "d MMM, HH:mm", { locale: es }) : 'N/A'}</span>
                            </div>
                         </div>
                         <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Término</span>
                                <span className="text-sm">{poll.closedAt ? format(poll.closedAt.toDate(), "d MMM, HH:mm", { locale: es }) : 'N/A'}</span>
                            </div>
                         </div>
                    </div>

                    <Separator />

                    {isLoading ? (
                        <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
                    ) : stats && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="text-center border rounded-lg p-3">
                                    <div className="flex justify-center mb-1"><Users className="h-4 w-4 text-muted-foreground" /></div>
                                    <div className="text-xl font-bold">{stats.universe}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase">En Sala</div>
                                </div>
                                <div className="text-center border rounded-lg p-3 bg-green-50/50 border-green-100">
                                    <div className="flex justify-center mb-1"><UserCheck className="h-4 w-4 text-green-600" /></div>
                                    <div className="text-xl font-bold text-green-700">{stats.enabled}</div>
                                    <div className="text-[10px] text-green-600 uppercase">Con Derecho</div>
                                </div>
                                <div className="text-center border rounded-lg p-3 bg-red-50/50 border-red-100">
                                    <div className="flex justify-center mb-1"><UserX className="h-4 w-4 text-red-600" /></div>
                                    <div className="text-xl font-bold text-red-700">{stats.disabled}</div>
                                    <div className="text-[10px] text-red-600 uppercase">No Habil.</div>
                                </div>
                                <div className="text-center border rounded-lg p-3 bg-primary/5 border-primary/20">
                                    <div className="flex justify-center mb-1"><VoteIcon className="h-4 w-4 text-primary" /></div>
                                    <div className="text-xl font-bold text-primary">{stats.cast}</div>
                                    <div className="text-[10px] text-primary uppercase">Votaron ({stats.participation.toFixed(1)}%)</div>
                                </div>
                                <div className={cn("text-center border rounded-lg p-3", stats.notVoted > 0 ? "bg-orange-50 border-orange-200" : "bg-muted/30")}>
                                    <div className="flex justify-center mb-1"><Users className={cn("h-4 w-4", stats.notVoted > 0 ? "text-orange-600" : "text-muted-foreground")} /></div>
                                    <div className={cn("text-xl font-bold", stats.notVoted > 0 ? "text-orange-700" : "")}>{stats.notVoted}</div>
                                    <div className={cn("text-[10px] uppercase", stats.notVoted > 0 ? "text-orange-600" : "text-muted-foreground")}>No Votaron</div>
                                </div>
                            </div>

                            <div className="bg-muted/20 p-3 rounded-md border space-y-2">
                                <div className={cn("flex items-center gap-2 text-xs font-medium", !stats.salaCuadra ? "text-destructive" : "text-muted-foreground")}>
                                    <div className={cn("h-1.5 w-1.5 rounded-full", stats.salaCuadra ? "bg-green-500" : "bg-destructive animate-pulse")} />
                                    Cuadratura Sala: {stats.universe} (Sala) = {stats.enabled} (Habilitados) + {stats.disabled} (No Habilitados)
                                    {!stats.salaCuadra && <span className="font-bold ml-2">⚠️ Los totales no cuadran</span>}
                                </div>
                                <div className={cn("flex items-center gap-2 text-xs font-medium", !stats.participaciónCuadra ? "text-destructive" : "text-muted-foreground")}>
                                    <div className={cn("h-1.5 w-1.5 rounded-full", stats.participaciónCuadra ? "bg-green-500" : "bg-destructive animate-pulse")} />
                                    Cuadratura Voto: {stats.enabled} (Derecho) = {stats.cast} (Votaron) + {stats.notVoted} (No Votaron)
                                    {!stats.participaciónCuadra && <span className="font-bold ml-2">⚠️ Los totales no cuadran</span>}
                                </div>
                                <div className={cn("flex items-center gap-2 text-xs font-bold", stats.notVoted > 0 ? "text-orange-600" : "text-green-600")}>
                                    {stats.notVoted > 0 ? (
                                        <>
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            {stats.notVoted} voluntarios habilitados no votaron.
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Todos los habilitados votaron.
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <Separator />

                    <div>
                        <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                            <Info className="h-4 w-4" /> Distribución de Resultados
                        </h4>
                        <div className="h-72 w-full">
                        {!isLoading && votes?.length === 0 ? (
                            <p className="text-center text-muted-foreground pt-16 italic">Aún no hay votos registrados.</p>
                        ) : (
                            <ChartContainer config={chartConfig} className="w-full h-full">
                                <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                                        width={120}
                                        />
                                    <Tooltip
                                        cursor={{ fill: "hsl(var(--muted))" }}
                                        content={<ChartTooltipContent 
                                            formatter={(value, name, item) => {
                                                const payload = item?.payload;
                                                if (!payload) return null;
                                                return (
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{payload.name}</span>
                                                        <span>{value} Votos ({payload.percentage?.toFixed(1) || '0.0'}%)</span>
                                                    </div>
                                                );
                                            }}
                                            hideIndicator
                                            hideLabel 
                                        />}
                                    />
                                    <Bar dataKey="votes" radius={4} fill="hsl(var(--primary))">
                                         <LabelList 
                                            dataKey="displayLabel" 
                                            position="right" 
                                            style={{ fill: 'hsl(var(--foreground))', fontSize: '12px', fontWeight: 'bold' }} 
                                         />
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        )}
                        </div>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-xs">Opción</TableHead>
                                    <TableHead className="text-right text-xs">Votos</TableHead>
                                    <TableHead className="text-right text-xs">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {chartData.map((item) => (
                                    <TableRow key={item.name}>
                                        <TableCell className="text-sm py-2 font-medium">{item.name}</TableCell>
                                        <TableCell className="text-right text-sm py-2">{item.votes}</TableCell>
                                        <TableCell className="text-right text-sm py-2">{item.percentage.toFixed(1)}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                
                <div className="text-center text-[10px] text-muted-foreground border-t pt-4">
                    Este informe fue generado automáticamente por E-lector. Los resultados son definitivos y auditables mediante el archivo PDF.
                </div>
            </DialogContent>
        </Dialog>
    );
}
