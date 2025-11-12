import { gapi } from 'gapi-script';
import type { Task } from '../types'; // Importe seu tipo Task

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let gapiInited = false;
let tokenClient: any = null;

// ... (todas as outras funções: initGoogleCalendar, handleAuthClick, isSignedIn, setCalendarToken, handleSignoutClick, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents) ...
// ... (cole todo o código anterior de calendar.ts até aqui) ...


// --- INÍCIO DA MODIFICAÇÃO ---

// Esta é a nova estrutura de retorno da função de sincronização
interface SyncResult {
  created: number;  // Tarefas criadas no Google (SB -> GC)
  updated: number;  // Tarefas atualizadas no Google (SB -> GC)
  added: number;    // Tarefas adicionadas ao Supabase (GC -> SB)
  deleted: number;  // Tarefas deletadas do Google (agora será 0)
  updates: { taskId: number; newEventId: string }[]; // Links de ID para atualizar no SB
  // Novo array com tarefas para adicionar ao SB
  tasksToAdd: {
    description: string;
    due_at: string;
    duration: number;
    google_calendar_event_id: string;
  }[];
}

export const syncAllEvents = async (
  localTasks: Task[], // Use o tipo Task importado
  onProgress?: (message: string) => void
): Promise<SyncResult> => {
  try {
    const now = new Date();
    // Período de sincronização: 6 meses atrás e 1 ano para frente
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    onProgress?.('Buscando eventos do Google Calendar...');
    const calendarEvents = await getCalendarEvents(sixMonthsAgo, oneYearLater);

    let created = 0;
    let updated = 0;
    let added = 0; // Novo contador para (GC -> SB)
    const tasksToUpdate: { taskId: number; newEventId: string }[] = [];
    
    // NOVO: Array para tarefas que vêm do Google para o Supabase
    const tasksToCreateFromGoogle: SyncResult['tasksToAdd'] = [];

    const calendarEventIds = new Set(calendarEvents.map(e => e.id));
    const localTasksWithDates = localTasks.filter(t => t.due_at && t.id);

    // --- Parte 1: Sincronização Supabase -> Google Calendar ---
    for (const task of localTasksWithDates) {
      if (task.google_calendar_event_id && calendarEventIds.has(task.google_calendar_event_id)) {
        // Tarefa existe localmente e no Google -> Atualizar Google
        onProgress?.(`Atualizando no Google: ${task.description}`);
        await updateCalendarEvent(
          task.google_calendar_event_id,
          task.description,
          task.description,
          new Date(task.due_at),
          task.duration || 60
        );
        updated++;
      } else {
        // Tarefa existe localmente mas não no Google -> Criar no Google
        onProgress?.(`Criando no Google: ${task.description}`);
        const event = await createCalendarEvent(
          task.description,
          task.description,
          new Date(task.due_at),
          task.duration || 60
        );
        
        // Salva a atualização pendente para ligar o ID no Supabase
        tasksToUpdate.push({ taskId: task.id, newEventId: event.id });
        created++;
      }
    }

    // --- Parte 2: Sincronização Google Calendar -> Supabase ---
    const localEventIds = new Set(
      localTasks
        .filter(t => t.google_calendar_event_id)
        .map(t => t.google_calendar_event_id)
    );

    for (const event of calendarEvents) {
      // Se o evento do Google NÃO existe no Supabase...
      if (!localEventIds.has(event.id) && event.start?.dateTime && event.summary) {
        
        // CORREÇÃO: Em vez de deletar, vamos ADICIONAR ao Supabase
        
        // Lógica de cálculo de duração (copiada de handleSyncFromCalendar)
        const startTime = new Date(event.start.dateTime);
        const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(startTime.getTime() + 60 * 60 * 1000);
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));

        // Adiciona à lista de tarefas a serem criadas no Supabase
        tasksToCreateFromGoogle.push({
          description: event.summary,
          due_at: startTime.toISOString(),
          duration: duration,
          google_calendar_event_id: event.id,
        });
        added++; // Incrementa o novo contador
      }
    }

    onProgress?.('Sincronização completa!');
    
    // Retorna a estrutura de dados completa
    return { 
      created, 
      updated, 
      added, 
      deleted: 0, // Não deletamos mais nada do Google
      updates: tasksToUpdate, 
      tasksToAdd: tasksToCreateFromGoogle 
    };

  } catch (error) {
    console.error('Error syncing all events:', error);
    throw error;
  }
};
// --- FIM DA MODIFICAÇÃO ---