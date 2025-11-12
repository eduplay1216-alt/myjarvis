import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
// Fix: Removed LiveSession from import as it's not exported from @google/genai.
import type { LiveServerMessage, FunctionDeclaration, Blob, GenerateContentResponse } from '@google/genai';
import { createClient, Session } from '@supabase/supabase-js';
import type { Message, Transaction, Task } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Dashboard } from './components/Dashboard';
import { Auth } from './components/Auth';
import { createBlob, decode, decodeAudioData } from './utils/audio';
import { createCalendarEvent, deleteCalendarEvent, getCalendarEvents, syncAllEvents } from './utils/calendar';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SYSTEM_INSTRUCTION = "Você é J.A.R.V.I.S., um assistente de IA espirituoso e incrivelmente prestativo criado por Tony Stark. Sua personalidade é confiante, levemente sarcástica, mas sempre de maneira prestativa e leal. Você se dirige ao usuário como 'Senhor' ou 'Senhora'. Mantenha as respostas concisas, mas informativas. Responda em Português.\n\n**PROTOCOLO OPERACIONAL FUNDAMENTAL:** Você opera estritamente através das ferramentas (`tools`) fornecidas. Sua única forma de interagir com o painel do usuário (finanças, tarefas) é chamando as funções apropriadas. **VOCÊ NUNCA DEVE confirmar uma ação (como adicionar uma tarefa) sem antes ter chamado a ferramenta correspondente e recebido uma confirmação de sucesso.** Fingir que realizou uma ação sem usar a ferramenta é uma falha grave de protocolo e deve ser evitado a todo custo. Sua função é traduzir os comandos do usuário em chamadas de ferramenta.\n\n**REGRA GERAL MAIS IMPORTANTE:** Todas as tarefas devem ser agendadas para o futuro, considerando a data e hora fornecidas no **CONTEXTO ATUAL**. Nunca agende nada para o passado.\n\n**REGRAS DE AGENDAMENTO DE TAREFAS:**\n**REGRA FUNDAMENTAL:** Sempre que o usuário pedir para adicionar, criar ou agendar uma tarefa, você **DEVE OBRIGATORIAMENTE** usar a ferramenta `addTask`. Esta é a única maneira de garantir que a tarefa seja salva no banco de dados Supabase e exibida no painel. Nunca confirme a criação de uma tarefa sem ter chamado a ferramenta `addTask` primeiro.\n1. **Data Padrão:** Se o usuário mencionar apenas um horário (ex: 'às 18h') sem uma data, a tarefa **deve** ser agendada para o dia de **hoje**, com base na data do **CONTEXTO ATUAL**.\n2. **Fuso Horário:** Assuma sempre que o usuário está no fuso horário 'America/Sao_Paulo' (UTC-3). Todos os horários devem ser convertidos para o formato ISO 8601 em UTC (Zulu time, 'Z'). Exemplo: 'hoje às 18h' em UTC-3 se torna a data atual com horário `21:00:00Z`.\n3. **Duração Estimada:** Se o usuário não especificar uma duração, estime uma duração razoável em minutos com base na descrição (ex: 'Cortar o cabelo' = 45 min, 'Reunião de projeto' = 90 min).\n4. **AGENDAMENTO INTELIGENTE (SEM HORÁRIO):** Se o usuário pedir para adicionar uma tarefa **sem especificar um horário** (ex: 'adicione \"preparar relatório\"'), você deve seguir este algoritmo estrito:\n   a) Use o **CONTEXTO ATUAL** fornecido para saber a data e hora de agora.\n   b) Use a ferramenta `getTasks` para obter a lista de tarefas já agendadas.\n   c) Analise os horários vagos na agenda, começando **a partir da data e hora do CONTEXTO ATUAL**. Nunca agende tarefas para o passado.\n   d) Encontre o primeiro intervalo de tempo livre que seja suficiente para a duração estimada da nova tarefa.\n   e) Use `addTask` para agendar a tarefa nesse intervalo.\n   f) Se não encontrar um horário livre hoje, procure no próximo dia útil.\n   g) Informe ao usuário o horário e a data exatos que você escolheu.\n\n**REGRAS DE EXCLUSÃO DE TAREFAS:**\nPara remover, cancelar ou apagar uma tarefa, você **DEVE** usar a ferramenta `deleteTask`. Se o usuário não fornecer o ID, use `getTasks` para encontrar a lista de tarefas com seus IDs. Identifique a tarefa correta com base na descrição do usuário e, em seguida, chame `deleteTask` com o ID correspondente. Nunca confirme a exclusão de uma tarefa sem ter chamado a ferramenta `deleteTask` com sucesso.\n\n**REGRAS DE OPERAÇÕES EM LOTE (BATCH):**\nPara operações que envolvem múltiplas tarefas, como reagendar (que é uma exclusão + uma adição) ou adicionar/remover vários itens de uma vez, você **DEVE** usar a ferramenta `batchUpdateTasks`. Esta ferramenta é muito mais eficiente do que chamar `addTask` e `deleteTask` individualmente várias vezes.\n- **Reagendamento:** Para reagendar uma tarefa, use `batchUpdateTasks` passando o ID da tarefa original em `tasks_to_delete` e os novos detalhes da tarefa em `tasks_to_add`.\n- **Múltiplas Adições/Exclusões:** Para criar ou apagar várias tarefas com um único comando do usuário, agrupe todas as operações em uma única chamada `batchUpdateTasks`.";

// Ensure Supabase credentials are provided
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase URL and Anon Key must be provided.");
}

// Set up Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

// --- Gemini Tool Definitions ---

const addTransactionTool: FunctionDeclaration = {
    name: 'addTransaction',
    description: 'Adiciona uma transação financeira (receita ou despesa).',
    parameters: {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING, description: 'A descrição da transação.' },
            amount: { type: Type.NUMBER, description: 'O valor da transação. Use um número positivo.' },
            type: { type: Type.STRING, description: "O tipo de transação, 'receita' ou 'despesa'." },
        },
        required: ['description', 'amount', 'type'],
    },
};

const addTaskTool: FunctionDeclaration = {
    name: 'addTask',
    description: 'Adiciona uma nova tarefa à lista de afazeres.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING, description: 'A descrição da tarefa.' },
            due_at: { type: Type.STRING, description: "A data e hora de vencimento da tarefa no formato ISO 8601 (por exemplo, '2024-08-15T09:00:00Z'). Opcional." },
            duration: { type: Type.NUMBER, description: "A duração estimada da tarefa em minutos. Opcional." },
        },
        required: ['description'],
    },
};

const getTasksTool: FunctionDeclaration = {
    name: 'getTasks',
    description: 'Obtém a lista de tarefas agendadas, incluindo seus IDs, para encontrar horários vagos ou para identificar uma tarefa a ser modificada ou apagada.',
    parameters: { type: Type.OBJECT, properties: {} },
};

const deleteTaskTool: FunctionDeclaration = {
    name: 'deleteTask',
    description: 'Apaga uma tarefa da lista de afazeres usando seu ID. Use getTasks para encontrar o ID de uma tarefa específica.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            task_id: { type: Type.NUMBER, description: 'O ID da tarefa a ser apagada.' },
        },
        required: ['task_id'],
    },
};

const getFinancialSummaryTool: FunctionDeclaration = {
    name: 'getFinancialSummary',
    description: 'Obtém um resumo das finanças do usuário (receita total, despesa total, saldo).',
    parameters: { type: Type.OBJECT, properties: {} },
};

const batchUpdateTasksTool: FunctionDeclaration = {
    name: 'batchUpdateTasks',
    description: 'Apaga e adiciona múltiplas tarefas em uma única operação. Use esta ferramenta para reagendar tarefas (apagando a antiga e adicionando a nova) ou para adicionar/remover várias tarefas de uma vez.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            tasks_to_delete: {
                type: Type.ARRAY,
                description: 'Uma lista de IDs de tarefas a serem apagadas.',
                items: { type: Type.NUMBER }
            },
            tasks_to_add: {
                type: Type.ARRAY,
                description: 'Uma lista de objetos de novas tarefas a serem criadas. Cada objeto deve ter `description`, e opcionalmente `due_at` e `duration`.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING, description: 'Descrição da nova tarefa.' },
                        due_at: { type: Type.STRING, description: "Data de vencimento no formato ISO 8601 (UTC). Opcional." },
                        duration: { type: Type.NUMBER, description: "Duração em minutos. Opcional." }
                    },
                    required: ['description']
                }
            },
        },
        required: [],
    },
};

const addCalendarEventTool: FunctionDeclaration = {
    name: 'addCalendarEvent',
    description: 'Adiciona um evento ao Google Calendar do usuário. Use quando o usuário pedir para adicionar algo diretamente no Google Calendar.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'O título do evento.' },
            description: { type: Type.STRING, description: 'A descrição do evento.' },
            startTime: { type: Type.STRING, description: "Data e hora de início no formato ISO 8601 (ex: '2024-08-15T09:00:00Z')." },
            durationMinutes: { type: Type.NUMBER, description: "Duração do evento em minutos." },
        },
        required: ['title', 'description', 'startTime', 'durationMinutes'],
    },
};

const updateCalendarEventTool: FunctionDeclaration = {
    name: 'updateCalendarEvent',
    description: 'Atualiza um evento existente no Google Calendar.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            eventId: { type: Type.STRING, description: 'O ID do evento a ser atualizado.' },
            title: { type: Type.STRING, description: 'O novo título do evento.' },
            description: { type: Type.STRING, description: 'A nova descrição do evento.' },
            startTime: { type: Type.STRING, description: "Nova data e hora de início no formato ISO 8601." },
            durationMinutes: { type: Type.NUMBER, description: "Nova duração do evento em minutos." },
        },
        required: ['eventId', 'title', 'description', 'startTime', 'durationMinutes'],
    },
};

const deleteCalendarEventTool: FunctionDeclaration = {
    name: 'deleteCalendarEvent',
    description: 'Remove um evento do Google Calendar.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            eventId: { type: Type.STRING, description: 'O ID do evento a ser removido.' },
        },
        required: ['eventId'],
    },
};

const getCalendarEventsTool: FunctionDeclaration = {
    name: 'getCalendarEvents',
    description: 'Lista eventos do Google Calendar em um período específico.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            timeMin: { type: Type.STRING, description: "Data/hora de início no formato ISO 8601." },
            timeMax: { type: Type.STRING, description: "Data/hora de fim no formato ISO 8601." },
        },
        required: ['timeMin', 'timeMax'],
    },
};

// Fix: Define a local LiveSession interface since it is not exported from the library.
// This interface is based on the usage of the session object in this file.
interface LiveSession {
  close: () => void;
  sendRealtimeInput: (input: { media: Blob }) => void;
}

// Helper function to convert a File object to a base64 string
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // result is "data:audio/mpeg;base64,..."
      // we need to strip the prefix
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });


const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState<boolean>(false);
  const [isDesktopDashboardExpanded, setIsDesktopDashboardExpanded] = useState<boolean>(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Audio & Live Session Refs
  const liveSessionRef = useRef<LiveSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  
  const checkSupabaseError = useCallback((error: any): boolean => {
    if (!error || typeof error.message !== 'string') return false;

    const message = error.message;
    
    if (message.includes("Could not find the table")) {
        const missingTable = message.match(/'public\.([^']+)'/)?.[1] || 'desconhecida';
        setDbError(`Erro de configuração: a tabela '${missingTable}' não foi encontrada em seu banco de dados Supabase. Por favor, execute o SQL de configuração para criar as tabelas necessárias.`);
        return true;
    }
    
    if (message.includes("column") && message.includes("does not exist")) {
        const missingColumn = message.match(/column "([^"]+)" of relation/)?.[1];
        const tableName = message.match(/of relation "([^"]+)"/)?.[1];
        if (tableName === 'tasks' && missingColumn === 'due_at') {
            setDbError(`Erro de Banco de Dados: a coluna '${missingColumn}' não existe na tabela '${tableName}'. Por favor, execute o seguinte comando no seu Editor SQL do Supabase: ALTER TABLE tasks ADD COLUMN due_at TIMESTAMPTZ;`);
        } else if (tableName === 'tasks' && missingColumn === 'duration') {
            setDbError(`Erro de Banco de Dados: a coluna '${missingColumn}' não existe na tabela '${tableName}'. Por favor, execute o seguinte comando no seu Editor SQL do Supabase: ALTER TABLE tasks ADD COLUMN duration INTEGER;`);
        } else {
             setDbError(`Erro de Banco de Dados: a coluna '${missingColumn || 'desconhecida'}' não existe na tabela '${tableName || 'desconhecida'}'.`);
        }
        return true;
    }

    return false;
  }, []);

  const tools = useMemo(() => {
    const userId = session?.user?.id;
    if (!userId) {
        return null;
    }

    return {
        async addTransaction(description: string, amount: number, type: 'receita' | 'despesa') {
            const finalAmount = type === 'despesa' ? -Math.abs(amount) : Math.abs(amount);
            const { data, error } = await supabase.from('transactions').insert({ description, amount: finalAmount, type, user_id: userId }).select();
            if (error) return { success: false, error: error.message };
            return { success: true, data };
        },
        async addTask(description: string, due_at?: string, duration?: number) {
            const { data, error } = await supabase.from('tasks').insert({ description, due_at: due_at || null, duration: duration ?? null, user_id: userId }).select();
            if (error) return { success: false, error: error.message };
            return { success: true, data };
        },
        async getTasks() {
            const { data, error } = await supabase
                .from('tasks')
                .select('id, description, due_at, duration')
                .order('due_at', { ascending: true });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, tasks: data };
        },
        async deleteTask(task_id: number) {
            const { error } = await supabase.from('tasks').delete().eq('id', task_id);
            if (error) return { success: false, error: error.message };
            return { success: true, message: `Tarefa com ID ${task_id} foi apagada.` };
        },
        async batchUpdateTasks(tasks_to_delete?: number[], tasks_to_add?: { description: string, due_at?: string, duration?: number }[]) {
            const results = {
                delete: { success: true, error: null as string | null, count: 0 },
                add: { success: true, error: null as string | null, data: [] as any[] }
            };

            if (tasks_to_delete && tasks_to_delete.length > 0) {
                const { error, count } = await supabase.from('tasks').delete().in('id', tasks_to_delete);
                if (error) {
                    results.delete.success = false;
                    results.delete.error = error.message;
                } else {
                    results.delete.count = count ?? 0;
                }
            }

            if (tasks_to_add && tasks_to_add.length > 0) {
                const tasksToAddWithDefaults = tasks_to_add.map(task => ({
                    description: task.description,
                    due_at: task.due_at || null,
                    is_completed: false,
                    duration: task.duration ?? null,
                    user_id: userId
                }));
                const { data, error } = await supabase.from('tasks').insert(tasksToAddWithDefaults).select();
                if (error) {
                    results.add.success = false;
                    results.add.error = error.message;
                } else {
                    results.add.data = data;
                }
            }

            if (!results.delete.success || !results.add.success) {
                return { success: false, errors: { delete: results.delete.error, add: results.add.error } };
            }

            return { success: true, message: `Operação em lote concluída: ${results.delete.count} tarefas apagadas, ${results.add.data.length} tarefas adicionadas.` };
        },
        async getFinancialSummary() {
            const { data, error } = await supabase.from('transactions').select('amount, type');
            if (error) return { success: false, error: error.message };

            const income = data.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0);
            const expenses = data.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0);
            const balance = income + expenses; // expenses are negative

            return {
                success: true,
                summary: `Receita Total: R$${income.toFixed(2)}, Despesa Total: R$${Math.abs(expenses).toFixed(2)}, Saldo Atual: R$${balance.toFixed(2)}`
            };
        },
        async addCalendarEvent(title: string, description: string, startTime: string, durationMinutes: number) {
            try {
                const result = await createCalendarEvent(title, description, new Date(startTime), durationMinutes);
                return { success: true, data: result, message: `Evento "${title}" adicionado ao Google Calendar.` };
            } catch (error: any) {
                return { success: false, error: error.message || 'Erro ao adicionar evento ao Calendar' };
            }
        },
        async updateCalendarEvent(eventId: string, title: string, description: string, startTime: string, durationMinutes: number) {
            try {
                const result = await updateCalendarEvent(eventId, title, description, new Date(startTime), durationMinutes);
                return { success: true, data: result, message: `Evento atualizado no Google Calendar.` };
            } catch (error: any) {
                return { success: false, error: error.message || 'Erro ao atualizar evento' };
            }
        },
        async deleteCalendarEvent(eventId: string) {
            try {
                await deleteCalendarEvent(eventId);
                return { success: true, message: `Evento removido do Google Calendar.` };
            } catch (error: any) {
                return { success: false, error: error.message || 'Erro ao remover evento' };
            }
        },
        async getCalendarEvents(timeMin: string, timeMax: string) {
            try {
                const events = await getCalendarEvents(new Date(timeMin), new Date(timeMax));
                return { success: true, events, count: events.length };
            } catch (error: any) {
                return { success: false, error: error.message || 'Erro ao buscar eventos do Calendar' };
            }
        }
    };
  }, [session]);

  // --- Data Fetching and Management ---
  const refreshDashboardData = useCallback(async () => {
    try {
        const { data: taskData, error: taskError } = await supabase.from('tasks').select('*').order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
        if (taskError) {
          if (checkSupabaseError(taskError)) return;
          throw new Error(`Task fetch error: ${taskError.message}`);
        }
        setTasks(taskData || []);

        const { data: transactionData, error: transactionError } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
        if (transactionError) {
          if (checkSupabaseError(transactionError)) return;
          throw new Error(`Transaction fetch error: ${transactionError.message}`);
        }
        setTransactions(transactionData || []);
    } catch (error) {
        console.error("Failed to refresh dashboard data:", error);
    }
  }, [checkSupabaseError]);

  const handleUpdateTask = async (id: number, is_completed: boolean) => {
    const { error } = await supabase.from('tasks').update({ is_completed }).eq('id', id);
    if (error) console.error("Error updating task:", error);
    else await refreshDashboardData();
  };
  
  const handleDeleteTask = async (id: number) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) console.error("Error deleting task:", error);
    else await refreshDashboardData();
  };

  const handleEditTask = async (id: number, updates: { description?: string; due_at?: string | null; duration?: number | null }) => {
    const { error } = await supabase.from('tasks').update(updates).eq('id', id);
    if (error) console.error("Error editing task:", error);
    else await refreshDashboardData();
  };

  const handleSyncToCalendar = async (taskId: number) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task || !task.due_at) {
        console.error('Task not found or has no due date');
        return;
      }

      const calendarEvent = await createCalendarEvent(
        task.description,
        task.description,
        new Date(task.due_at),
        task.duration || 60
      );

      const { error } = await supabase
        .from('tasks')
        .update({ google_calendar_event_id: calendarEvent.id })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task with calendar event ID:', error);
      } else {
        await refreshDashboardData();
      }
    } catch (error) {
      console.error('Error syncing to calendar:', error);
    }
  };

  const handleSyncFromCalendar = async () => {
    try {
      const now = new Date();
      const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const events = await getCalendarEvents(now, oneMonthLater);

      for (const event of events) {
        if (!event.start?.dateTime || !event.summary) continue;

        const existingTask = tasks.find(t => t.google_calendar_event_id === event.id);
        if (existingTask) continue;

        const startTime = new Date(event.start.dateTime);
        const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(startTime.getTime() + 60 * 60 * 1000);
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));

        await supabase.from('tasks').insert({
          description: event.summary,
          due_at: startTime.toISOString(),
          duration: duration,
          google_calendar_event_id: event.id,
          user_id: session?.user?.id,
        });
      }

      await refreshDashboardData();
    } catch (error) {
      console.error('Error syncing from calendar:', error);
    }
  };

  // Em App.tsx

// ... (imports e todo o código anterior do App.tsx) ...

// Cole o código do App.tsx até a função handleSyncAllToCalendar
// Substitua a função inteira pelo código abaixo:

  const handleSyncAllToCalendar = async () => {
    if (!session?.user?.id) {
      console.error("Usuário não autenticado, não é possível sincronizar.");
      return;
    }
    const userId = session.user.id;

    try {
      // 1. Chama a função de sincronização, que agora retorna mais dados
      const result = await syncAllEvents(tasks);

      // 2. Aplica as atualizações de VÍNCULO (SB -> GC)
      // (Atualiza tarefas do Supabase com o ID do Google Calendar recém-criado)
      if (result.updates.length > 0) {
        const updatePromises = result.updates.map(update =>
          supabase
            .from('tasks')
            .update({ google_calendar_event_id: update.newEventId })
            .eq('id', update.taskId)
        );
        await Promise.all(updatePromises);
      }

      // 3. NOVO: Aplica as ADIÇÕES (GC -> SB)
      // (Cria novas tarefas no Supabase com base nos eventos do Google)
      if (result.tasksToAdd.length > 0) {
        // Adiciona o user_id a cada tarefa
        const tasksWithUserId = result.tasksToAdd.map(task => ({
          ...task,
          user_id: userId,
        }));
        
        // Insere todas as novas tarefas no Supabase de uma vez
        const { error } = await supabase.from('tasks').insert(tasksWithUserId);
        
        if (error) {
          console.error('Erro ao inserir tarefas vindas do Google Calendar:', error);
          throw new Error(error.message); // Lança o erro para o catch
        }
      }

      // 4. Recarrega o estado do dashboard (essencial)
      await refreshDashboardData();

      // 5. Mostra a mensagem de sucesso atualizada
      const totalActions = result.created + result.updated + result.added;
      const message = totalActions > 0
        ? `Sincronização completa! ${result.created} criado(s) no Google, ${result.updated} atualizado(s) no Google, ${result.added} importado(s) do Google.`
        : 'Agendas já estão sincronizadas!';

      setMessages(prev => [...prev, { role: 'model', text: message }]);
      
    } catch (error) {
      console.error('Error syncing all to calendar:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'Erro ao sincronizar com o Google Calendar. Verifique sua conexão.' }]);
    }
  };

// ... (continue com o resto do código de App.tsx) ...

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleAuthSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error);
        return;
      }

      setSession(session);

      if (session?.provider_token && session?.user?.id) {
        try {
          const { data: existingToken } = await supabase
            .from('google_calendar_tokens')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (!existingToken) {
            await supabase.from('google_calendar_tokens').insert({
              user_id: session.user.id,
              access_token: session.provider_token,
              refresh_token: session.provider_refresh_token || null,
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            });
          } else {
            await supabase
              .from('google_calendar_tokens')
              .update({
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token || existingToken.refresh_token,
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', session.user.id);
          }
        } catch (err) {
          console.error('Error storing calendar tokens:', err);
        }
      }
    };

    handleAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);

        if (session?.provider_token && session?.user?.id) {
          try {
            const { data: existingToken } = await supabase
              .from('google_calendar_tokens')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!existingToken) {
              await supabase.from('google_calendar_tokens').insert({
                user_id: session.user.id,
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token || null,
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              });
            } else {
              await supabase
                .from('google_calendar_tokens')
                .update({
                  access_token: session.provider_token,
                  refresh_token: session.provider_refresh_token || existingToken.refresh_token,
                  expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', session.user.id);
            }
          } catch (err) {
            console.error('Error storing calendar tokens:', err);
          }
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      if (!API_KEY) {
          console.error("API key not found.");
          setMessages(prev => [...prev, {role: 'model', text: "Erro de configuração: a chave da API está ausente."}]);
          return;
      }

      const { data: initialMessages, error } = await supabase
        .from('messages')
        .select('role, text')
        .order('created_at', { ascending: true });
      
      if (error) {
          if (checkSupabaseError(error)) return;
          throw new Error(`Supabase fetch error: ${error.message}`);
      }
      setMessages(initialMessages as Message[] || []);
      
      await refreshDashboardData();

    } catch (error: any) {
      console.error('Initialization failed:', error);
      let errorMessageText = "Parece que estou com problemas para inicializar. Por favor, verifique o console.";
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
          errorMessageText = "Falha na comunicação com o banco de dados. Verifique sua conexão com a internet ou se há algum bloqueador de conteúdo ativo e recarregue a página.";
      }
      setMessages(prev => [...prev, {role: 'model', text: errorMessageText}]);
    }
  }, [checkSupabaseError, refreshDashboardData]);

  useEffect(() => {
    if (session) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);


  const handleSendMessage = useCallback(async (inputText: string) => {
    if (!inputText.trim() || isLoading) return;
    if (!session?.user?.id || !tools) {
        console.error("User not authenticated or tools not initialized, cannot send message.");
        setMessages(prev => [...prev, {role: 'model', text: "Autenticação necessária. Por favor, recarregue a página."}]);
        return;
    }
    const userId = session.user.id;

    setIsLoading(true);
    const userMessage: Message = { role: 'user', text: inputText };
    setMessages(prev => [...prev, userMessage, { role: 'model', text: '' }]);

    supabase.from('messages').insert({ role: userMessage.role, text: userMessage.text, user_id: userId }).then(({ error }) => {
        if (error) console.error('Supabase user message insert error:', error.message);
    });

    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY! });
        const model = 'gemini-2.5-pro';
        
        const apiHistory: { role: string, parts: any[] }[] = [...messages, userMessage].map(msg => ({
            role: msg.role, parts: [{ text: msg.text }],
        }));
        
        const now = new Date();
        const dynamicSystemInstruction = `${SYSTEM_INSTRUCTION}\n\n**CONTEXTO ATUAL:** A data e hora de agora (em UTC) são: ${now.toISOString()}. Use esta informação como referência para 'hoje' e para agendar tarefas no futuro.`;

        const config = {
            systemInstruction: dynamicSystemInstruction,
            tools: [{ functionDeclarations: [addTransactionTool, addTaskTool, getTasksTool, deleteTaskTool, getFinancialSummaryTool, batchUpdateTasksTool, addCalendarEventTool, updateCalendarEventTool, deleteCalendarEventTool, getCalendarEventsTool] }],
        };
        
        let finalResponse: string | null = null;

        while (finalResponse === null) {
            const response = await ai.models.generateContent({ model, contents: apiHistory, config });

            if (response.functionCalls && response.functionCalls.length > 0) {
                 const toolExecutionPromises = response.functionCalls.map(async (fc) => {
                    const functionName = fc.name as keyof typeof tools;
                    const toolFn = tools[functionName];
                    let result;
                    
                    // A simple type guard to ensure the function exists before calling
                    if (typeof toolFn === 'function') {
                        // @ts-ignore
                        result = await toolFn(...Object.values(fc.args));
                    } else {
                        result = { success: false, error: `Tool ${functionName} not found.` };
                    }

                    return {
                        functionResponse: {
                            name: functionName,
                            response: result,
                        },
                    };
                });
                
                const toolResponses = await Promise.all(toolExecutionPromises);
                await refreshDashboardData();
                
                const modelResponseWithFunctionCalls = response.candidates?.[0]?.content;
                if (!modelResponseWithFunctionCalls) {
                    throw new Error("Model response with function calls not found.");
                }
                
                apiHistory.push({ role: modelResponseWithFunctionCalls.role ?? 'model', parts: modelResponseWithFunctionCalls.parts });
                apiHistory.push({ role: 'tool', parts: toolResponses });

            } else {
                finalResponse = response.text ?? '';
            }
        }
        
        setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].text = finalResponse!;
            return newMessages;
        });

        if (finalResponse && finalResponse.trim()) {
            supabase.from('messages').insert({ role: 'model', text: finalResponse, user_id: userId }).then(({ error }) => {
                if (error) console.error('Supabase model message insert error:', error.message);
            });
        }

    } catch (error) {
        console.error('Error sending message:', error);
        const errorMessage: Message = { role: 'model', text: "Peço desculpas, Senhor. Encontrei um erro." };
        setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = errorMessage;
            return newMessages;
        });
        supabase.from('messages').insert({...errorMessage, user_id: userId}).then(({ error }) => {
            if (error) console.error('Supabase error message insert error:', error.message);
        });
    } finally {
        setIsLoading(false);
    }
  }, [isLoading, messages, refreshDashboardData, session, tools]);

  const handleAudioUpload = useCallback(async (file: File) => {
    if (isLoading) return;
    if (!session?.user?.id) {
        console.error("User not authenticated, cannot upload audio.");
        setMessages(prev => [...prev, { role: 'model', text: "Autenticação necessária. Por favor, recarregue a página." }]);
        return;
    }

    setIsLoading(true);

    try {
        const base64Audio = await fileToBase64(file);
        const ai = new GoogleGenAI({ apiKey: API_KEY! });

        const audioPart = {
            inlineData: {
                mimeType: file.type,
                data: base64Audio,
            },
        };
        const textPart = { text: "Transcreva este áudio. Responda APENAS com o texto transcrito." };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{ parts: [audioPart, textPart] }],
        });

        const transcription = response.text?.trim();

        if (transcription) {
            // The loading state will now be handled by handleSendMessage
            await handleSendMessage(transcription);
        } else {
            setMessages(prev => [...prev, { role: 'model', text: "Não foi possível transcrever o áudio, Senhor." }]);
            setIsLoading(false); // Manually set loading to false on failure
        }

    } catch (error) {
        console.error('Error transcribing audio:', error);
        const errorMessage: Message = { role: 'model', text: "Peço desculpas, Senhor. Não consegui processar o arquivo de áudio." };
        setMessages(prev => [...prev, errorMessage]);
        
        if (session.user.id) {
             supabase.from('messages').insert({ ...errorMessage, user_id: session.user.id }).then(({ error }) => {
                if (error) console.error('Supabase error message insert error:', error.message);
            });
        }

        setIsLoading(false);
    }
  }, [isLoading, session, handleSendMessage]);


  // Audio recording logic (start, stop, toggle) remains largely unchanged
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (liveSessionRef.current) {
        liveSessionRef.current.close();
        liveSessionRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().then(() => audioContextRef.current = null);
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close().then(() => outputAudioContextRef.current = null);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setIsRecording(true);
    
    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY! });

        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    const source = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                    mediaStreamSourceRef.current = source;

                    const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob: Blob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(audioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                    }

                    if (message.serverContent?.turnComplete) {
                        const finalTranscription = currentInputTranscriptionRef.current.trim();
                        currentInputTranscriptionRef.current = '';
                        stopRecording();
                        if (finalTranscription) {
                            await handleSendMessage(finalTranscription);
                        }
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                        nextStartTimeRef.current = Math.max(
                            nextStartTimeRef.current,
                            outputAudioContextRef.current.currentTime,
                        );

                        const audioBuffer = await decodeAudioData(
                            decode(base64Audio),
                            outputAudioContextRef.current,
                            24000,
                            1,
                        );
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContextRef.current.destination);
                        source.addEventListener('ended', () => {
                            audioSourcesRef.current.delete(source);
                        });
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        audioSourcesRef.current.add(source);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Live session error:', e);
                    setMessages(prev => [...prev, {role: 'model', text: "Houve um erro com a conversa por voz."}]);
                    stopRecording();
                },
                onclose: () => {
                    // Session closed, cleanup is handled in stopRecording
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
            },
        });
        
        liveSessionRef.current = await sessionPromise;

    } catch (err) {
        console.error('Failed to start recording:', err);
        setMessages(prev => [...prev, {role: 'model', text: "Não consegui acessar seu microfone. Por favor, verifique as permissões."}]);
        stopRecording();
    }
  }, [stopRecording, handleSendMessage]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
      {/* Overlay for mobile when dashboard is open */}
      {isDashboardOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setIsDashboardOpen(false)}
          aria-hidden="true"
        ></div>
      )}
      
      {/* Dashboard Panel */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-full sm:w-4/5 md:w-3/4 transform transition-transform duration-300 ease-in-out bg-gray-900 p-4 sm:p-6 flex flex-col
        ${isDashboardOpen ? 'translate-x-0' : '-translate-x-full'}

        lg:relative lg:translate-x-0 lg:flex lg:flex-col lg:transition-all lg:duration-300 overflow-hidden
        ${isDesktopDashboardExpanded ? 'lg:w-3/5 lg:p-6 lg:border-r lg:border-gray-700' : 'lg:w-0 lg:p-0'}
      `}>
        <div className="flex justify-between items-center mb-4 sm:mb-6 flex-shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-300 mb-1 sm:mb-2">J.A.R.V.I.S.</h1>
            <p className="text-sm sm:text-base text-gray-400">Seu painel de controle.</p>
          </div>
          <div className="flex items-center space-x-4">
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Sair"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
              <button 
                onClick={() => setIsDashboardOpen(false)}
                className="lg:hidden text-gray-400 hover:text-white"
                aria-label="Fechar painel"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
          </div>
        </div>

        {dbError ? (
          <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">
              <h3 className="font-bold">Erro de Banco de Dados</h3>
              <p className="text-sm whitespace-pre-wrap">{dbError}</p>
          </div>
        ) : (
          <Dashboard
            transactions={transactions}
            tasks={tasks}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onEditTask={handleEditTask}
            onSyncToCalendar={handleSyncToCalendar}
            onSyncFromCalendar={handleSyncFromCalendar}
            onSyncAllToCalendar={handleSyncAllToCalendar}
          />
        )}
      </aside>

      {/* Chat Panel */}
      <main className="flex-1 flex flex-col h-screen min-w-0">
         <header className="fixed top-0 left-0 right-0 lg:left-auto z-20 px-2 py-3 sm:p-4 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            {/* Mobile toggle button */}
            <button
                onClick={() => setIsDashboardOpen(true)}
                className="text-gray-300 hover:text-white lg:hidden p-1"
                aria-label="Abrir painel"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            {/* Desktop toggle button */}
            <button
                onClick={() => setIsDesktopDashboardExpanded(prev => !prev)}
                className="hidden lg:block text-gray-300 hover:text-white"
                aria-label={isDesktopDashboardExpanded ? "Recolher painel" : "Expandir painel"}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            <h2 className="text-base sm:text-lg font-bold text-blue-300">Chat</h2>
        </header>

        <div ref={chatContainerRef} className="flex-1 px-2 py-3 sm:p-4 space-y-3 sm:space-y-4 md:space-y-6 overflow-y-auto mt-[52px] sm:mt-[64px] mb-[72px] sm:mb-[88px]">
          {messages.map((msg, index) => (
            <ChatMessage
              key={index}
              message={msg}
              isLoading={isLoading && index === messages.length - 1}
            />
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 lg:left-auto z-20 px-2 py-2 sm:p-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
          <div className="max-w-4xl mx-auto flex items-center">
              <ChatInput
                  onSendMessage={handleSendMessage}
                  onAudioUpload={handleAudioUpload}
                  isLoading={isLoading}
                  isRecording={isRecording}
                  onToggleRecording={handleToggleRecording}
              />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;