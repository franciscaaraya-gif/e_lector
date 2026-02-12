'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection, serverTimestamp, writeBatch, doc, query, where } from 'firebase/firestore';
import { PlusCircle, Loader2, Trash2, Plus, GripVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { VoterGroup, PollTemplate, ListaCompletaItem } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription } from '../ui/alert';

const formSchema = z.object({
  question: z.string().min(5, 'La pregunta debe tener al menos 5 caracteres.').max(200, 'La pregunta no puede exceder los 200 caracteres.'),
  options: z.array(
    z.object({
      text: z.string().min(1, 'La opción no puede estar vacía.'),
    })
  ).min(2, 'Debe haber al menos 2 opciones.'),
  pollType: z.enum(['simple', 'multiple'], {
    required_error: 'Debes seleccionar un tipo de votación.',
  }),
  maxSelections: z.coerce.number().optional(),
  groupId: z.string({ required_error: 'Debes seleccionar un grupo de votantes.' }),
}).refine(data => {
    if (data.pollType === 'multiple') {
        return data.maxSelections && data.maxSelections > 1 && data.maxSelections <= data.options.length;
    }
    return true;
}, {
    message: 'Para selección múltiple, el número de opciones a marcar debe ser mayor que 1 y menor o igual al total de opciones.',
    path: ['maxSelections'],
});


const AutocompleteInput = ({ control, index, volunteers }: { control: any, index: number, volunteers: ListaCompletaItem[] }) => {
    const { field } = useController({
        control,
        name: `options.${index}.text`
    });

    const [suggestions, setSuggestions] = useState<ListaCompletaItem[]>([]);
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        field.onChange(value); 

        if (value.length >= 3) {
            const filtered = volunteers.filter(v =>
                `${v.nombres} ${v.apellidos}`.toLowerCase().includes(value.toLowerCase())
            );
            setSuggestions(filtered);
            setPopoverOpen(filtered.length > 0);
        } else {
            setSuggestions([]);
            setPopoverOpen(false);
        }
    };

    const handleSuggestionClick = (volunteer: ListaCompletaItem) => {
        const fullName = `${volunteer.nombres} ${volunteer.apellidos}`;
        field.onChange(fullName);
        setPopoverOpen(false);
    };

    return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
                <Input
                    placeholder={`Opción ${index + 1}`}
                    value={field.value || ''}
                    onChange={handleInputChange}
                    autoComplete="off"
                    className="flex-1"
                />
            </PopoverTrigger>
            <PopoverContent 
                className="w-[--radix-popover-trigger-width] p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <ScrollArea className="max-h-48">
                    {suggestions.map(v => (
                        <div
                            key={v.id}
                            className="p-2 hover:bg-accent cursor-pointer text-sm"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSuggestionClick(v);
                            }}
                        >
                            {v.nombres} {v.apellidos}
                        </div>
                    ))}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};

export function CreatePollDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
  const [isCargoElection, setIsCargoElection] = useState(false);

  const groupsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `admins/${user.uid}/groups`);
  }, [user, firestore]);

  const { data: voterGroups, isLoading: groupsLoading } = useCollection<VoterGroup>(groupsQuery);

  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `admins/${user.uid}/poll_templates`);
  }, [user, firestore]);
  const { data: pollTemplates, isLoading: templatesLoading } = useCollection<PollTemplate>(templatesQuery);

  const volunteersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isCargoElection) return null;
    return query(collection(firestore, 'admins', user.uid, 'lista_completa'), where('tipo', '!=', 'Martir '));
  }, [firestore, user, isCargoElection]);
  const { data: volunteers } = useCollection<ListaCompletaItem>(volunteersQuery);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: '',
      options: [{ text: '' }, { text: '' }],
      pollType: 'simple',
      groupId: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  const pollType = form.watch('pollType');

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === 'custom') {
        form.setValue('question', '');
        form.setValue('pollType', 'simple');
        form.setValue('maxSelections', undefined);
        form.clearErrors('maxSelections');
        setIsCargoElection(false);
    } else {
        const template = pollTemplates?.find(t => t.id === templateId);
        if (template) {
            form.setValue('question', template.question);
            form.setValue('pollType', template.pollType);
            if (template.pollType === 'multiple' && template.maxSelections) {
                form.setValue('maxSelections', template.maxSelections);
            } else {
                form.setValue('maxSelections', undefined);
            }
            form.trigger('maxSelections');
            setIsCargoElection(template.eleccionDeCargo || false);
        }
    }
  };


  const resetDialog = () => {
    form.reset({
        question: '',
        options: [{ text: '' }, { text: '' }],
        pollType: 'simple',
        groupId: undefined,
    });
    setIsLoading(false);
    setSelectedTemplateId('custom');
    setIsCargoElection(false);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return toast({ variant: 'destructive', title: 'Error de Autenticación' });
    if (!voterGroups) return toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los grupos.' });
    
    setIsLoading(true);

    try {
        const selectedGroup = voterGroups.find(g => g.id === values.groupId);
        if (!selectedGroup || !selectedGroup.voters) {
            setIsLoading(false);
            return toast({ variant: 'destructive', title: 'Grupo inválido', description: 'El grupo seleccionado no existe o está vacío.' });
        }

        const enabledVoters = selectedGroup.voters.filter(v => v.enabled !== false);
        if (enabledVoters.length === 0) {
            setIsLoading(false);
            return toast({ variant: 'destructive', title: 'Grupo sin votantes', description: 'El grupo seleccionado no tiene votantes habilitados.' });
        }

        const pollsCollection = collection(firestore, 'admins', user.uid, 'polls');
        const newPollRef = doc(pollsCollection);

        const newPollData = {
            id: newPollRef.id,
            question: values.question,
            options: values.options.map((opt, index) => ({ id: `opt_${index + 1}`, text: opt.text })),
            pollType: values.pollType,
            ...(values.pollType === 'multiple' && { maxSelections: values.maxSelections }),
            groupId: values.groupId,
            status: 'active' as const,
            adminId: user.uid,
            createdAt: serverTimestamp(),
        };

        const batch = writeBatch(firestore);

        batch.set(newPollRef, newPollData);
        
        const votersSubcollectionRef = collection(firestore, 'admins', user.uid, 'polls', newPollRef.id, 'voters');
        enabledVoters.forEach(voter => {
            const newVoterDocRef = doc(votersSubcollectionRef);
            batch.set(newVoterDocRef, {
                voterId: voter.id,
                pollId: newPollRef.id,
                hasVoted: false,
                adminId: user.uid, 
                enabled: true,
            });
        });

        const lookupRef = doc(firestore, 'poll-lookup', newPollRef.id);
        batch.set(lookupRef, { adminId: user.uid });
        
        await batch.commit();

        toast({
            title: '¡Votación Creada!',
            description: `La votación se asignó a ${enabledVoters.length} votantes del grupo "${selectedGroup.name}".`,
        });

        setOpen(false);
        resetDialog();

    } catch (error: any) {
        if (error.code && error.code.startsWith('permission-denied')) {
            const permissionError = new FirestorePermissionError({
                path: `admins/${user.uid}/polls`,
                operation: 'create',
                requestResourceData: values,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
             toast({
                variant: 'destructive',
                title: 'Error al crear la votación',
                description: error.message || 'No se pudo crear la votación. Revisa la consola para más detalles.'
            });
        }
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" disabled={groupsLoading || !voterGroups || voterGroups.length === 0}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Votación
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Crear Nueva Votación</DialogTitle>
          <DialogDescription>
            Configura los detalles de tu votación. Se creará como "activa" inmediatamente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto pr-6 pl-1 -mr-4">
            <FormItem>
              <FormLabel>Plantilla de Votación (Opcional)</FormLabel>
              <Select onValueChange={handleTemplateChange} value={selectedTemplateId} disabled={templatesLoading}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={templatesLoading ? "Cargando plantillas..." : "Usar una plantilla..."} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="custom">Personalizada (desde cero)</SelectItem>
                  {pollTemplates?.map(template => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Seleccionar una plantilla llenará automáticamente el tipo de votación y otras opciones.
              </FormDescription>
            </FormItem>
            
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pregunta de la Votación</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: ¿Cuál es tu color favorito?" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='space-y-2'>
              <FormLabel>Opciones de Respuesta</FormLabel>
              {isCargoElection && (
                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                    <AlertDescription>
                        Elección de Cargo: Escribe 3+ letras del nombre o apellido para buscar en la lista de voluntarios.
                    </AlertDescription>
                </Alert>
              )}
              {fields.map((field, index) => (
                  <FormField
                  key={field.id}
                  control={form.control}
                  name={`options.${index}.text`}
                  render={({ field: formField }) => (
                      <FormItem>
                          <FormControl>
                            <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                {isCargoElection ? (
                                    <AutocompleteInput
                                        control={form.control}
                                        index={index}
                                        volunteers={volunteers || []}
                                    />
                                ) : (
                                    <Input placeholder={`Opción ${index + 1}`} {...formField} />
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn('h-8 w-8', fields.length <= 2 && "invisible")}
                                    onClick={() => remove(index)}
                                    disabled={fields.length <= 2}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
                  />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Opción
              </Button>
            </div>

            <FormField
              control={form.control}
              name="pollType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tipo de Votación</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-1"
                      disabled={selectedTemplateId !== 'custom'}
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="simple" />
                        </FormControl>
                        <FormLabel className="font-normal">
                         Elección Simple (un solo voto por persona)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="multiple" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Selección Múltiple (varios votos por persona)
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {pollType === 'multiple' && (
              <FormField
                control={form.control}
                name="maxSelections"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo de Opciones a Marcar</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ej: 3" {...field} min={2} disabled={selectedTemplateId !== 'custom'} />
                    </FormControl>
                    <FormDescription>
                      El número de opciones que cada votante puede seleccionar.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupo de Votantes</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={groupsLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={groupsLoading ? "Cargando grupos..." : "Selecciona un grupo"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {voterGroups?.map(group => (
                        <SelectItem key={group.id} value={group.id}>{group.name} ({(group.voters || []).length} votantes)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                   <FormDescription>
                      Este es el grupo de personas que podrá votar en la votación.
                    </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-0 -mx-6 px-6 border-t">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Votación
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    