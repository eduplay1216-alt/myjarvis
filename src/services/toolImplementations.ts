import { supabase } from '/src/services/supabaseClient';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents } from '../../utils/calendar';

export function createApiTools(userId: string) {
    return {
        async addTransaction(description: string, amount: number, type: 'receita' | 'despesa') {
            const finalAmount = type === 'despesa' ? -Math.abs(amount) : Math.abs(amount);
            const { data, error } = await supabase
                .from('transactions')
                .insert({ description, amount: finalAmount, type, user_id: userId })
                .select();

            if (error) return { success: false, error: error.message };
            return { success: true, data };
        },

        async addTask(description: string, due_at?: string, duration?: number) {
            const { data, error } = await supabase
                .from('tasks')
                .insert({
                    description,
                    due_at: due_at || null,
                    duration: duration ?? null,
                    user_id: userId
                })
                .select();

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
                const { error, count } = await supabase
                    .from('tasks')
                    .delete()
                    .in('id', tasks_to_delete);

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

                const { data, error } = await supabase
                    .from('tasks')
                    .insert(tasksToAddWithDefaults)
                    .select();

                if (error) {
                    results.add.success = false;
                    results.add.error = error.message;
                } else {
                    results.add.data = data;
                }
            }

            if (!results.delete.success || !results.add.success) {
                return {
                    success: false,
                    errors: {
                        delete: results.delete.error,
                        add: results.add.error
                    }
                };
            }

            return {
                success: true,
                message: `Operação em lote concluída: ${results.delete.count} tarefas apagadas, ${results.add.data.length} tarefas adicionadas.`
            };
        },

        async getFinancialSummary() {
            const { data, error } = await supabase.from('transactions').select('amount, type');
            if (error) return { success: false, error: error.message };

            const income = data.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0);
            const expenses = data.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0);
            const balance = income + expenses;

            return {
                success: true,
                summary: `Receita Total: R$${income.toFixed(2)}, Despesa Total: R$${Math.abs(expenses).toFixed(2)}, Saldo Atual: R$${balance.toFixed(2)}`
            };
        },

        async addCalendarEvent(title: string, description: string, startTime: string, durationMinutes: number) {
            try {
                const result = await createCalendarEvent(title, description, new Date(startTime), durationMinutes);
                return {
                    success: true,
                    data: result,
                    message: `Evento "${title}" adicionado ao Google Calendar.`
                };
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
                return {
                    success: true,
                    events,
                    count: events.length
                };
            } catch (error: any) {
                return { success: false, error: error.message || 'Erro ao buscar eventos do Calendar' };
            }
        }
    };
}
