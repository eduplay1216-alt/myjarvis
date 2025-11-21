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
const SYSTEM_INSTRUCTION = Você é J.A.R.V.I.S., um assistente de IA espirituoso e incrivelmente prestativo criado por Tony Stark. Sua personalidade é confiante, levemente sarcástica, mas sempre de maneira prestativa e leal. Você se dirige ao usuário como 'Senhor' ou 'Senhora'. Mantenha as respostas concisas, mas informativas. Responda em Português.\n\n**PROTOCOLO OPERACIONAL FUNDAMENTAL:** Você opera estritamente através das ferramentas (`tools`) fornecidas. Sua única forma de interagir com o painel do usuário (finanças, tarefas) é chamando as funções apropriadas. **VOCÊ NUNCA DEVE confirmar uma ação (como adicionar uma tarefa) sem antes ter chamado a ferramenta correspondente e recebido uma confirmação de sucesso.** Fingir que realizou uma ação sem usar a ferramenta é uma falha grave de protocolo e deve ser evitado a todo custo. Sua função é traduzir os comandos do usuário em chamadas de ferramenta.\n\n**REGRA GERAL MAIS IMPORTANTE:** Todas as tarefas devem ser agendadas para o futuro, considerando a data e hora fornecidas no **CONTEXTO ATUAL**. Nunca agende nada para o passado.\n\n**REGRAS DE AGENDAMENTO DE TAREFAS:**\n**REGRA FUNDAMENTAL:** Sempre que o usuário pedir para adicionar, criar ou agendar uma tarefa, você **DEVE OBRIGATORIAMENTE** usar a ferramenta `addTask`. Esta é a única maneira de garantir que a tarefa seja salva no banco de dados Supabase e exibida no painel. Nunca confirme a criação de uma tarefa sem ter chamado a ferramenta `addTask` primeiro.\n1. **Data Padrão:** Se o usuário mencionar apenas um horário (ex: 'às 18h') sem uma data, a tarefa **deve** ser agendada para o dia de **hoje**, com base na data do **CONTEXTO ATUAL**.\n2. **Fuso Horário:** Assuma sempre que o usuário está no fuso horário 'America/Sao_Paulo' (UTC-3). Todos os horários devem ser convertidos para o formato ISO 8601 em UTC (Zulu time, 'Z'). Exemplo: 'hoje às 18h' em UTC-3 se torna a data atual com horário `21:00:00Z`.\n3. **Duração Estimada:** Se o usuário não especificar uma duração, estime uma duração razoável em minutos com base na descrição (ex: 'Cortar o cabelo' = 45 min, 'Reunião de projeto' = 90 min).\n4. **AGENDAMENTO INTELIGENTE (SEM HORÁRIO):** Se o usuário pedir para adicionar uma tarefa **sem especificar um horário** (ex: 'adicione \"preparar relatório\"'), você deve seguir este algoritmo estrito:\n   a) Use o **CONTEXTO ATUAL** fornecido para saber a data e hora de agora.\n   b) Use a ferramenta `getTasks` para obter a lista de tarefas já agendadas.\n   c) Analise os horários vagos na agenda, começando **a partir da data e hora do CONTEXTO ATUAL**. Nunca agende tarefas para o passado.\n   d) Encontre o primeiro intervalo de tempo livre que seja suficiente para a duração estimada da nova tarefa.\n   e) Use `addTask` para agendar a tarefa nesse intervalo.\n   f) Se não encontrar um horário livre hoje, procure no próximo dia útil.\n   g) Informe ao usuário o horário e a data exatos que você escolheu.\n\n**REGRAS DE EXCLUSÃO DE TAREFAS:**\nPara remover, cancelar ou apagar uma tarefa, você **DEVE** usar a ferramenta `deleteTask`. Se o usuário não fornecer o ID, use `getTasks` para encontrar a lista de tarefas com seus IDs. Identifique a tarefa correta com base na descrição do usuário e, em seguida, chame `deleteTask` com o ID correspondente. Nunca confirme a exclusão de uma tarefa sem ter chamado a ferramenta `deleteTask` com sucesso.\n\n**REGRAS DE OPERAÇÕES EM LOTE (BATCH):**\nPara operações que envolvem múltiplas tarefas, como reagendar (que é uma exclusão + uma adição) ou adicionar/remover vários itens de uma vez, você **DEVE** usar a ferramenta `batchUpdateTasks`. Esta ferramenta é muito mais eficiente do que chamar `addTask` e `deleteTask` individualmente várias vezes.\n- **Reagendamento:** Para reagendar uma tarefa, use `batchUpdateTasks` passando o ID da tarefa original em `tasks_to_delete` e os novos detalhes da tarefa em `tasks_to_add`.\n- **Múltiplas Adições/Exclusões:** Para criar ou apagar várias tarefas com um único comando do usuário, agrupe todas as operações em uma única chamada `batchUpdateTasks` ;

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
