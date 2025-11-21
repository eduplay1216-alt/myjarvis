import { useState, useCallback } from 'react';
import type { Transaction, Task } from '../../types';
import { supabase } from '/src/services/supabaseClient';
import { createCalendarEvent, getCalendarEvents, syncAllEvents } from '../../utils/calendar';

export function useDatabase() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [dbError, setDbError] = useState<string | null>(null);

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

    const handleSyncFromCalendar = async (userId: string | undefined) => {
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
                    user_id: userId,
                });
            }

            await refreshDashboardData();
        } catch (error) {
            console.error('Error syncing from calendar:', error);
        }
    };

    const handleSyncAllToCalendar = async () => {
        try {
            const result = await syncAllEvents(tasks);

            if (result.updates.length > 0) {
                const updatePromises = result.updates.map(update =>
                    supabase
                        .from('tasks')
                        .update({ google_calendar_event_id: update.newEventId })
                        .eq('id', update.taskId)
                );
                await Promise.all(updatePromises);
            }

            await refreshDashboardData();

            const totalActions = result.created + result.updated + result.deleted;
            const message = totalActions > 0
                ? `Sincronização completa! ${result.created} criado(s), ${result.updated} atualizado(s), ${result.deleted} removido(s).`
                : 'Agendas já estão sincronizadas!';

            return message;
        } catch (error) {
            console.error('Error syncing all to calendar:', error);
            throw error;
        }
    };

    return {
        transactions,
        tasks,
        dbError,
        refreshDashboardData,
        handleUpdateTask,
        handleDeleteTask,
        handleEditTask,
        handleSyncToCalendar,
        handleSyncFromCalendar,
        handleSyncAllToCalendar,
        checkSupabaseError
    };
}
