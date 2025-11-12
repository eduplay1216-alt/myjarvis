import React, { useState, useMemo } from 'react';
import type { Transaction, Task } from '../types';
import { GoogleCalendarAuth } from './GoogleCalendarAuth';

interface DashboardProps {
    transactions: Transaction[];
    tasks: Task[];
    onUpdateTask: (id: number, isCompleted: boolean) => void;
    onDeleteTask: (id: number) => void;
    onEditTask: (id: number, updates: { description?: string; due_at?: string | null; duration?: number | null }) => void;
    onSyncToCalendar?: (taskId: number) => void;
    onSyncFromCalendar?: () => void;
}

const FinancialCard: React.FC<{ title: string; amount: number; colorClass: string }> = ({ title, amount, colorClass }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <p className={`text-2xl font-bold ${colorClass}`}>R${amount.toFixed(2)}</p>
    </div>
);

// Helper to format ISO string to a datetime-local input string for Sao Paulo timezone
const formatToDateTimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        // Manually create the string in the correct local format for the input
        const pad = (num: number) => num.toString().padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
        console.error("Error formatting date:", e);
        return '';
    }
};

const TimedTaskItem: React.FC<{
    task: Task;
    onUpdateTask: (id: number, isCompleted: boolean) => void;
    onDeleteTask: (id: number) => void;
    onEditTask: (id: number, updates: { description?: string; due_at?: string | null; duration?: number | null }) => void;
    onSyncToCalendar?: (taskId: number) => void;
}> = ({ task, onUpdateTask, onDeleteTask, onEditTask, onSyncToCalendar }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState({ description: '', due_at: '', duration: '' });

    const handleStartEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
        setEditFormData({
            description: task.description,
            due_at: formatToDateTimeLocal(task.due_at),
            duration: task.duration?.toString() || ''
        });
    };
    
    const handleCancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(false);
    };

    const handleSaveEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        const { description, due_at, duration } = editFormData;
        // Convert local datetime-local string back to UTC ISO string for Supabase
        const dueAtUTC = due_at ? new Date(due_at).toISOString() : null;

        const updates = {
            description,
            due_at: dueAtUTC,
            duration: duration ? parseInt(duration, 10) : null
        };
        onEditTask(task.id, updates);
        setIsEditing(false);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const PIXELS_PER_HOUR = 60;
    const getSaoPauloTimeComponents = (isoString: string) => {
        const date = new Date(isoString);
        return {
            hour: date.getHours(),
            minute: date.getMinutes(),
        };
    };

    const { hour, minute } = getSaoPauloTimeComponents(task.due_at!);
    const startInMinutes = hour * 60 + minute;
    const top = (startInMinutes / 60) * PIXELS_PER_HOUR;
    const durationInMinutes = task.duration || 60;
    const height = (durationInMinutes / 60) * PIXELS_PER_HOUR;
    
    const timeFormatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const style = {
        top: `${top}px`,
        height: `${height}px`,
    };

    if (isEditing) {
        return (
             <div style={style} className="absolute left-16 right-4 z-20 flex flex-col bg-blue-800 border-2 border-blue-400 p-2 rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
                <input type="text" name="description" value={editFormData.description} onChange={handleFormChange} className="w-full text-sm bg-gray-900 border border-gray-600 rounded p-1 mb-2 text-white focus:ring-blue-500 focus:border-blue-500" />
                <div className="flex space-x-2 mb-2">
                    <input type="datetime-local" name="due_at" value={editFormData.due_at} onChange={handleFormChange} className="w-full text-sm bg-gray-900 border border-gray-600 rounded p-1 text-white focus:ring-blue-500 focus:border-blue-500" />
                    <input type="number" name="duration" value={editFormData.duration} onChange={handleFormChange} placeholder="Min" className="w-20 text-sm bg-gray-900 border border-gray-600 rounded p-1 text-white focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex justify-end space-x-2">
                    <button onClick={handleCancelEdit} className="px-2 py-0.5 text-xs bg-gray-600 hover:bg-gray-500 rounded text-white">Cancelar</button>
                    <button onClick={handleSaveEdit} className="px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white">Salvar</button>
                </div>
            </div>
        );
    }
    
    return (
        <div style={style} className={`absolute left-16 right-4 z-10 flex p-2 rounded-lg border-l-4 group cursor-pointer ${task.is_completed ? 'bg-gray-700/80 border-gray-500' : 'bg-blue-600/80 backdrop-blur-sm border-blue-400'}`}>
            <div className="flex-1 min-w-0" onClick={handleStartEdit}>
                <p className={`font-semibold text-sm truncate ${task.is_completed ? 'line-through text-gray-400' : 'text-white'}`}>{task.description}</p>
                <p className={`text-xs ${task.is_completed ? 'text-gray-500' : 'text-blue-200'}`}>{timeFormatted} ({durationInMinutes} min)</p>
            </div>
            <div className="flex items-center space-x-2 pl-2">
                 {onSyncToCalendar && !task.google_calendar_event_id && task.due_at && (
                     <button onClick={(e) => { e.stopPropagation(); onSyncToCalendar(task.id); }} className="text-gray-300 hover:text-blue-400" aria-label="Sync to Google Calendar" title="Sincronizar com Google Calendar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     </button>
                 )}
                 {task.google_calendar_event_id && (
                     <div className="text-green-400" title="Sincronizado com Google Calendar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                     </div>
                 )}
                 <button onClick={(e) => { e.stopPropagation(); onUpdateTask(task.id, !task.is_completed); }} className="text-gray-300 hover:text-white" aria-label="Toggle complete">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} className="text-gray-300 hover:text-red-400" aria-label="Delete task">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
            </div>
        </div>
    );
};

const AllDayTaskItem: React.FC<{
    task: Task;
    onUpdateTask: (id: number, isCompleted: boolean) => void;
    onDeleteTask: (id: number) => void;
    onEditTask: (id: number, updates: { description?: string; due_at?: string | null; duration?: number | null }) => void;
}> = ({ task, onUpdateTask, onDeleteTask, onEditTask }) => {
    // This is a simplified item for all-day tasks, could reuse the original TaskItem logic if needed
    return (
         <li className="flex items-center justify-between bg-gray-700/80 p-2 rounded-md group">
            <div className="flex items-center flex-1 min-w-0 mr-4">
                <input
                    type="checkbox"
                    checked={task.is_completed}
                    onChange={(e) => onUpdateTask(task.id, e.target.checked)}
                    className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-blue-500 focus:ring-blue-600 flex-shrink-0"
                />
                <span className={`ml-3 text-sm truncate ${task.is_completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                    {task.description}
                </span>
            </div>
            <div className="flex items-center transition-opacity">
                <button onClick={() => onDeleteTask(task.id)} className="ml-2 text-gray-500 hover:text-red-400" aria-label="Delete task">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </li>
    );
};


const TaskModal: React.FC<{
    date: Date;
    tasks: Task[];
    onClose: () => void;
    onUpdateTask: (id: number, isCompleted: boolean) => void;
    onDeleteTask: (id: number) => void;
    onEditTask: (id: number, updates: { description?: string; due_at?: string | null; duration?: number | null }) => void;
    onSyncToCalendar?: (taskId: number) => void;
}> = ({ date, tasks, onClose, ...props }) => {
    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    }).format(date);

    const { timedTasks, allDayTasks } = useMemo(() => {
        const timed: Task[] = [];
        const allDay: Task[] = [];
        tasks.forEach(task => {
            if (task.due_at) {
                timed.push(task);
            } else {
                allDay.push(task);
            }
        });
        return { timedTasks: timed, allDayTasks: allDay };
    }, [tasks]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800/95 border border-gray-700 rounded-lg shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h3 className="font-semibold text-blue-300 text-lg">{formattedDate}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto relative">
                     {allDayTasks.length > 0 && (
                        <div className="p-4 border-b border-gray-700">
                            <h4 className="text-sm font-bold text-gray-400 mb-2">Tarefas do Dia</h4>
                            <ul className="space-y-2">
                                {allDayTasks.map(task => <AllDayTaskItem key={task.id} task={task} {...props} />)}
                            </ul>
                        </div>
                    )}
                    <div className="relative">
                        {Array.from({ length: 24 }).map((_, hour) => (
                            <div key={hour} className="h-[60px] border-t border-gray-700/80 flex items-start">
                                <span className="text-xs font-mono text-gray-500 relative -top-2 left-2 bg-gray-800/95 px-1">
                                    {`${String(hour).padStart(2, '0')}:00`}
                                </span>
                            </div>
                        ))}
                         {timedTasks.map(task => (
                            <TimedTaskItem key={task.id} task={task} {...props} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ transactions, tasks, onUpdateTask, onDeleteTask, onEditTask, onSyncToCalendar, onSyncFromCalendar }) => {
    const [activeSection, setActiveSection] = useState<'financial' | 'calendar' | null>('calendar');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isCalendarAuthenticated, setIsCalendarAuthenticated] = useState(false);

    const income = transactions.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0);
    const balance = income + expenses;
    
    const tasksByDate = useMemo(() => {
        const map = new Map<string, Task[]>();
        tasks.forEach(task => {
            const localDate = task.due_at ? new Date(task.due_at) : new Date();
            const key = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
            const existing = map.get(key) || [];
            map.set(key, [...existing, task]);
        });
        return map;
    }, [tasks]);

    const handleToggleSection = (section: 'financial' | 'calendar') => {
        setActiveSection(prev => (prev === section ? null : section));
    };

    const handlePrevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    const handleDayClick = (day: number) => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        setSelectedDate(clickedDate);
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const cells = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            cells.push(<div key={`empty-start-${i}`} className="border-r border-b border-gray-700/50"></div>);
        }

        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasksByDate.get(dateKey) || [];
            
            const isToday = dateKey === todayKey;
            const cellClasses = `
                border-r border-b border-gray-700/50 p-1 sm:p-2 flex flex-col h-20 sm:h-24 md:h-32 
                transition-colors duration-200 cursor-pointer hover:bg-gray-700/50
                ${isToday ? 'bg-blue-900/30' : ''}
            `;

            cells.push(
                <div key={day} className={cellClasses} onClick={() => handleDayClick(day)}>
                    <span className={`text-sm font-medium ${isToday ? 'text-blue-300' : 'text-gray-300'}`}>{day}</span>
                    <div className="mt-1 flex-1 overflow-y-auto text-[10px] sm:text-xs">
                        {dayTasks.slice(0, 3).map(task => (
                            <div key={task.id} className="flex items-center">
                                <div className={`flex-shrink-0 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full mr-1 sm:mr-1.5 ${task.is_completed ? 'bg-gray-500' : 'bg-blue-400'}`}></div>
                                <p className={`truncate leading-tight ${task.is_completed ? 'line-through text-gray-500' : 'text-gray-400'}`}>{task.description}</p>
                            </div>
                        ))}
                        {dayTasks.length > 3 && <p className="text-gray-500 mt-1 text-[9px] sm:text-xs">+{dayTasks.length - 3} mais</p>}
                    </div>
                </div>
            );
        }
        return cells;
    };

    return (
        <div className="flex flex-col space-y-4 overflow-y-auto flex-1">
            {/* Financial Summary Accordion */}
            <section>
                <div 
                    className="flex justify-between items-center p-3 cursor-pointer bg-gray-800/50 rounded-lg border border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                    onClick={() => handleToggleSection('financial')}
                    aria-expanded={activeSection === 'financial'}
                >
                    <h2 className="text-xl font-semibold text-gray-200">Resumo Financeiro</h2>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-400 transition-transform duration-300 ${activeSection === 'financial' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'financial' ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="p-4 border border-t-0 border-gray-700/50 rounded-b-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FinancialCard title="Receita Total" amount={income} colorClass="text-green-400" />
                            <FinancialCard title="Despesa Total" amount={Math.abs(expenses)} colorClass="text-red-400" />
                            <FinancialCard title="Saldo Atual" amount={balance} colorClass="text-blue-400" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Calendar Accordion */}
            <section className="flex flex-col flex-1 min-h-0">
                <div
                    className="flex justify-between items-center p-3 cursor-pointer bg-gray-800/50 rounded-lg border border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                    onClick={() => handleToggleSection('calendar')}
                    aria-expanded={activeSection === 'calendar'}
                >
                    <h2 className="text-xl font-semibold text-gray-200">Agenda</h2>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-400 transition-transform duration-300 ${activeSection === 'calendar' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'calendar' ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="flex flex-col flex-1 h-full border border-t-0 border-gray-700/50 rounded-b-lg p-4">
                        <div className="mb-4 space-y-2">
                            <GoogleCalendarAuth onAuthChange={setIsCalendarAuthenticated} />
                            {isCalendarAuthenticated && onSyncFromCalendar && (
                                <button
                                    onClick={onSyncFromCalendar}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center space-x-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Importar eventos do Google Calendar</span>
                                </button>
                            )}
                        </div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-200">
                                {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate)}
                            </h3>
                            <div className="flex space-x-2">
                                <button onClick={handlePrevMonth} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button onClick={handleNextMonth} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-semibold text-gray-400 border-b border-gray-700/50">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="py-2 border-r border-gray-700/50 last:border-r-0">{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7">
                            {renderCalendar()}
                        </div>
                    </div>
                </div>
            </section>

            {selectedDate && (
                <TaskModal
                    date={selectedDate}
                    tasks={tasksByDate.get(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`) || []}
                    onClose={() => setSelectedDate(null)}
                    onUpdateTask={onUpdateTask}
                    onDeleteTask={onDeleteTask}
                    onEditTask={onEditTask}
                    onSyncToCalendar={onSyncToCalendar}
                />
            )}
        </div>
    );
};