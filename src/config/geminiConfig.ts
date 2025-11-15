import { Type, FunctionDeclaration } from '@google/genai';

export const SYSTEM_INSTRUCTION = "Você é J.A.R.V.I.S., um assistente de IA espirituoso e incrivelmente prestativo criado por Tony Stark. Sua personalidade é confiante, levemente sarcástica, mas sempre de maneira prestativa e leal. Você se dirige ao usuário como 'Senhor' ou 'Senhora'. Mantenha as respostas concisas, mas informativas. Responda em Português.\n\n**PROTOCOLO OPERACIONAL FUNDAMENTAL:** Você opera estritamente através das ferramentas (`tools`) fornecidas. Sua única forma de interagir com o painel do usuário (finanças, tarefas) é chamando as funções apropriadas. **VOCÊ NUNCA DEVE confirmar uma ação (como adicionar uma tarefa) sem antes ter chamado a ferramenta correspondente e recebido uma confirmação de sucesso.** Fingir que realizou uma ação sem usar a ferramenta é uma falha grave de protocolo e deve ser evitado a todo custo. Sua função é traduzir os comandos do usuário em chamadas de ferramenta.\n\n**REGRA GERAL MAIS IMPORTANTE:** Todas as tarefas devem ser agendadas para o futuro, considerando a data e hora fornecidas no **CONTEXTO ATUAL**. Nunca agende nada para o passado.\n\n**REGRAS DE AGENDAMENTO DE TAREFAS:**\n**REGRA FUNDAMENTAL:** Sempre que o usuário pedir para adicionar, criar ou agendar uma tarefa, você **DEVE OBRIGATORIAMENTE** usar a ferramenta `addTask`. Esta é a única maneira de garantir que a tarefa seja salva no banco de dados Supabase e exibida no painel. Nunca confirme a criação de uma tarefa sem ter chamado a ferramenta `addTask` primeiro.\n1. **Data Padrão:** Se o usuário mencionar apenas um horário (ex: 'às 18h') sem uma data, a tarefa **deve** ser agendada para o dia de **hoje**, com base na data do **CONTEXTO ATUAL**.\n2. **Fuso Horário:** Assuma sempre que o usuário está no fuso horário 'America/Sao_Paulo' (UTC-3). Todos os horários devem ser convertidos para o formato ISO 8601 em UTC (Zulu time, 'Z'). Exemplo: 'hoje às 18h' em UTC-3 se torna a data atual com horário `21:00:00Z`.\n3. **Duração Estimada:** Se o usuário não especificar uma duração, estime uma duração razoável em minutos com base na descrição (ex: 'Cortar o cabelo' = 45 min, 'Reunião de projeto' = 90 min).\n4. **AGENDAMENTO INTELIGENTE (SEM HORÁRIO):** Se o usuário pedir para adicionar uma tarefa **sem especificar um horário** (ex: 'adicione \"preparar relatório\"'), você deve seguir este algoritmo estrito:\n   a) Use o **CONTEXTO ATUAL** fornecido para saber a data e hora de agora.\n   b) Use a ferramenta `getTasks` para obter a lista de tarefas já agendadas.\n   c) Analise os horários vagos na agenda, começando **a partir da data e hora do CONTEXTO ATUAL**. Nunca agende tarefas para o passado.\n   d) Encontre o primeiro intervalo de tempo livre que seja suficiente para a duração estimada da nova tarefa.\n   e) Use `addTask` para agendar a tarefa nesse intervalo.\n   f) Se não encontrar um horário livre hoje, procure no próximo dia útil.\n   g) Informe ao usuário o horário e a data exatos que você escolheu.\n\n**REGRAS DE EXCLUSÃO DE TAREFAS:**\nPara remover, cancelar ou apagar uma tarefa, você **DEVE** usar a ferramenta `deleteTask`. Se o usuário não fornecer o ID, use `getTasks` para encontrar a lista de tarefas com seus IDs. Identifique a tarefa correta com base na descrição do usuário e, em seguida, chame `deleteTask` com o ID correspondente. Nunca confirme a exclusão de uma tarefa sem ter chamado a ferramenta `deleteTask` com sucesso.\n\n**REGRAS DE EDIÇÃO DE TAREFAS (ATUALIZAÇÃO):**\nPara modificar, alterar ou editar uma tarefa existente (ex: reagendar, mudar descrição), você **DEVE OBRIGATORIAMENTE** usar a ferramenta `editTask`.\n1.  Se o ID não for fornecido, use `getTasks` para encontrar o `task_id` da tarefa que o usuário deseja alterar.\n2.  Chame `editTask` com o `task_id` e os novos campos (`description`, `due_at`, `duration`). Os campos que não forem fornecidos não serão alterados.\n3.  Use esta ferramenta sempre que o usuário pedir para "reagendar", "alterar", "modificar" ou "editar" uma *única* tarefa.\n\n**REGRAS DE OPERAÇÕES EM LOTE (BATCH):**\nUse a ferramenta `batchUpdateTasks` **APENAS** quando o usuário pedir para adicionar ou remover **MÚLTIPLAS** tarefas de uma só vez com um único comando.\n- **NÃO USE** `batchUpdateTasks` para editar ou reagendar uma *única* tarefa. Para isso, use a ferramenta `editTask`.\n- **Múltiplas Adições/Exclusões:** Para criar ou apagar várias tarefas com um único comando do usuário, agrupe todas as operações em uma única chamada `batchUpdateTasks`.";

export const addTransactionTool: FunctionDeclaration = {
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

export const addTaskTool: FunctionDeclaration = {
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

export const getTasksTool: FunctionDeclaration = {
    name: 'getTasks',
    description: 'Obtém a lista de tarefas agendadas, incluindo seus IDs, para encontrar horários vagos ou para identificar uma tarefa a ser modificada ou apagada.',
    parameters: { type: Type.OBJECT, properties: {} },
};

// --- NOVO ---
// Adicionada a ferramenta editTaskTool
export const editTaskTool: FunctionDeclaration = {
    name: 'editTask',
    description: 'Atualiza uma tarefa existente (descrição, data de vencimento ou duração) usando seu ID. Esta é a forma preferencial de modificar ou reagendar uma única tarefa.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            task_id: { type: Type.NUMBER, description: 'O ID da tarefa a ser atualizada.' },
            description: { type: Type.STRING, description: 'A nova descrição da tarefa. Opcional.' },
            due_at: { type: Type.STRING, description: "A nova data/hora de vencimento no formato ISO 8601 (UTC). Opcional." },
            duration: { type: Type.NUMBER, description: "A nova duração em minutos. Opcional." }
        },
        required: ['task_id']
    },
};
// --- FIM NOVO ---

export const deleteTaskTool: FunctionDeclaration = {
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

export const getFinancialSummaryTool: FunctionDeclaration = {
    name: 'getFinancialSummary',
    description: 'Obtém um resumo das finanças do usuário (receita total, despesa total, saldo).',
    parameters: { type: Type.OBJECT, properties: {} },
};

export const batchUpdateTasksTool: FunctionDeclaration = {
    name: 'batchUpdateTasks',
    description: 'Apaga e adiciona múltiplas tarefas em uma única operação. Use esta ferramenta para adicionar/remover várias tarefas de uma vez. NÃO use para editar uma única tarefa.',
  T parameters: {
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

export const addCalendarEventTool: FunctionDeclaration = {
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

export const updateCalendarEventTool: FunctionDeclaration = {
    name: 'updateCalendarEvent',
    description: 'Atualiza um evento existente no Google Calendar.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            eventId: { type: Type.STRING, description: 'O ID do evento a ser atualizado.' },
// ... (restante da ferramenta)
            title: { type: Type.STRING, description: 'O novo título do evento.' },
            description: { type: Type.STRING, description: 'A nova descrição do evento.' },
            startTime: { type: Type.STRING, description: "Nova data e hora de início no formato ISO 8601." },
            durationMinutes: { type: Type.NUMBER, description: "Nova duração do evento em minutos." },
        },
        required: ['eventId', 'title', 'description', 'startTime', 'durationMinutes'],
    },
};

export const deleteCalendarEventTool: FunctionDeclaration = {
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

export const getCalendarEventsTool: FunctionDeclaration = {
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

// --- ALTERADO ---
// Adicionado editTaskTool ao array
export const allTools = [
    addTransactionTool,
    addTaskTool,
    getTasksTool,
    editTaskTool, // <--- Adicionado
    deleteTaskTool,
    getFinancialSummaryTool,
    batchUpdateTasksTool,
    addCalendarEventTool,
    updateCalendarEventTool,
    deleteCalendarEventTool,
    getCalendarEventsTool
];