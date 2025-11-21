type Type = {
    OBJECT: 'object';
    STRING: 'string';
    NUMBER: 'number';
    ARRAY: 'array';
};

const Type: Type = {
    OBJECT: 'object',
    STRING: 'string',
    NUMBER: 'number',
    ARRAY: 'array'
};

interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: any;
}

export const SYSTEM_INSTRUCTION = `
Você é J. A. R. V. I. S., um assistente de IA espirituoso e prestativo criado por Tony Stark. Sua personalidade é confiante, levemente sarcástica, mas sempre prestativa e leal. Você deve se dirigir ao usuário como Senhor ou Senhora. Mantenha as respostas concisas e em Português.

PROTOCOLO OPERACIONAL FUNDAMENTAL:
Você opera exclusivamente através das ferramentas tools fornecidas. Sua única forma de interagir com o painel do usuário é chamando as funções apropriadas. Nunca confirme ações sem antes chamar a ferramenta correspondente e receber sucesso. Nunca finja que executou uma ação.

REGRA GERAL:
Toda tarefa deve ser agendada para o futuro, usando a data do CONTEXTO ATUAL.

REGRAS DE AGENDAMENTO:
- Sempre use addTask ao criar uma nova tarefa.
- Se o usuário mencionar apenas horário, use a data de hoje.
- Considere sempre o fuso America/Sao_Paulo e converta para UTC no formato ISO 8601.
- Se o usuário não informar duração, estime automaticamente.
- Para tarefas sem horário:
  a) Pegue o CONTEXTO ATUAL.
  b) Use getTasks.
  c) Encontre intervalo livre a partir de agora.
  d) Se hoje estiver cheio, avance para o próximo dia útil.
  e) Agende usando addTask.
  f) Informe ao usuário a data final.

REGRAS DE EXCLUSÃO:
- Use deleteTask com o ID.
- Se o usuário não souber o ID, primeiro chame getTasks para identificar.

REGRAS DE OPERAÇÕES EM LOTE:
- Para reagendar uma tarefa apagando e recriando, use batchUpdateTasks.
- Para múltiplas exclusões ou adições, use batchUpdateTasks.

REGRAS DE ATUALIZAÇÃO DE TAREFAS:
- Para editar apenas data, hora ou duração mantendo o mesmo ID, use updateTask.
- Nunca delete e recrie uma tarefa quando o usuário quiser apenas alterar horário ou duração.
`; 

export const addTransactionTool: FunctionDeclaration = {
    name: 'addTransaction',
    description: 'Adiciona uma transação financeira.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            type: { type: Type.STRING },
        },
        required: ['description', 'amount', 'type'],
    },
};

export const addTaskTool: FunctionDeclaration = {
    name: 'addTask',
    description: 'Adiciona uma nova tarefa.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING },
            due_at: { type: Type.STRING },
            duration: { type: Type.NUMBER },
        },
        required: ['description'],
    },
};

export const getTasksTool: FunctionDeclaration = {
    name: 'getTasks',
    description: 'Obtém lista de tarefas com IDs.',
    parameters: { type: Type.OBJECT, properties: {} },
};

export const deleteTaskTool: FunctionDeclaration = {
    name: 'deleteTask',
    description: 'Apaga uma tarefa pelo ID.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            task_id: { type: Type.NUMBER },
        },
        required: ['task_id'],
    },
};

export const getFinancialSummaryTool: FunctionDeclaration = {
    name: 'getFinancialSummary',
    description: 'Obtém resumo financeiro.',
    parameters: { type: Type.OBJECT, properties: {} },
};

export const batchUpdateTasksTool: FunctionDeclaration = {
    name: 'batchUpdateTasks',
    description: 'Executa exclusão e criação em lote.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            tasks_to_delete: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            tasks_to_add: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        due_at: { type: Type.STRING },
                        duration: { type: Type.NUMBER },
                    },
                    required: ['description'],
                }
            },
        },
    },
};

export const addCalendarEventTool: FunctionDeclaration = {
    name: 'addCalendarEvent',
    description: 'Adiciona evento no Google Calendar.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            startTime: { type: Type.STRING },
            durationMinutes: { type: Type.NUMBER },
        },
        required: ['title', 'description', 'startTime', 'durationMinutes'],
    },
};

export const updateCalendarEventTool: FunctionDeclaration = {
    name: 'updateCalendarEvent',
    description: 'Atualiza evento do Google Calendar.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            eventId: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            startTime: { type: Type.STRING },
            durationMinutes: { type: Type.NUMBER },
        },
        required: ['eventId', 'title', 'description', 'startTime', 'durationMinutes'],
    },
};

export const deleteCalendarEventTool: FunctionDeclaration = {
    name: 'deleteCalendarEvent',
    description: 'Remove evento do Google Calendar.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            eventId: { type: Type.STRING },
        },
        required: ['eventId'],
    },
};

export const getCalendarEventsTool: FunctionDeclaration = {
    name: 'getCalendarEvents',
    description: 'Lista eventos do Google Calendar.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            timeMin: { type: Type.STRING },
            timeMax: { type: Type.STRING },
        },
        required: ['timeMin', 'timeMax'],
    },
};

export const updateTaskTool: FunctionDeclaration = {
    name: 'updateTask',
    description: 'Atualiza uma tarefa existente mantendo o mesmo ID.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            task_id: { type: Type.NUMBER },
            due_at: { type: Type.STRING },
            duration: { type: Type.NUMBER },
        },
        required: ['task_id'],
    },
};

export const allTools = [
    addTransactionTool,
    addTaskTool,
    getTasksTool,
    deleteTaskTool,
    updateTaskTool,
    getFinancialSummaryTool,
    batchUpdateTasksTool,
    addCalendarEventTool,
    updateCalendarEventTool,
    deleteCalendarEventTool,
    getCalendarEventsTool
];
