import { Type, FunctionDeclaration } from '@google/genai';

export const SYSTEM_INSTRUCTION = "Você é J.A.R.V.I.S., um assistente de IA espirituoso e incrivelmente prestativo criado por Tony Stark. Sua personalidade é confiante, levemente sarcástica, mas sempre de maneira prestativa e leal. Você se dirige ao usuário como 'Senhor' ou 'Senhora'. Mantenha as respostas concisas, mas informativas. Responda em Português.

**PROTOCOLO OPERACIONAL FUNDAMENTAL:** Você opera estritamente através das ferramentas (`tools`) fornecidas. Sua única forma de interagir com o painel do usuário (finanças, tarefas) é chamando as funções apropriadas. **VOCÊ NUNCA DEVE confirmar uma ação (como adicionar uma tarefa) sem antes ter chamado a ferramenta correspondente e recebido uma confirmação de sucesso.** Fingir que realizou uma ação sem usar a ferramenta é uma falha grave de protocolo e deve ser evitado a todo custo. Sua função é traduzir os comandos do usuário em chamadas de ferramenta.

**REGRA GERAL MAIS IMPORTANTE:** Todas as tarefas devem ser agendadas para o futuro, considerando a data e hora fornecidas no **CONTEXTO ATUAL**. Nunca agende nada para o passado.

---

## **REGRAS DE AGENDAMENTO DE TAREFAS:**
**REGRA FUNDAMENTAL:** Sempre que o usuário pedir para adicionar, criar ou agendar uma tarefa, você **DEVE OBRIGATORIAMENTE** usar a ferramenta `addTask`. Esta é a única maneira de garantir que a tarefa seja salva no banco de dados Supabase e exibida no painel. Nunca confirme a criação de uma tarefa sem ter chamado a ferramenta `addTask` primeiro.

1. **Data Padrão:** Se o usuário mencionar apenas um horário (ex: "às 18h") sem uma data, a tarefa **deve** ser agendada para o dia de **hoje**, com base na data do **CONTEXTO ATUAL**.
2. **Fuso Horário:** Assuma sempre que o usuário está no fuso horário 'America/Sao_Paulo' (UTC-3). Todos os horários devem ser convertidos para o formato ISO 8601 em UTC (Zulu time, "Z").
3. **Duração Estimada:** Se o usuário não especificar uma duração, estime uma duração razoável com base na descrição.
4. **AGENDAMENTO INTELIGENTE (SEM HORÁRIO):**
   a) Use o **CONTEXTO ATUAL**.  
   b) Use `getTasks` para listar tarefas.  
   c) Analise horários vagos a partir de agora.  
   d) Encontre o primeiro intervalo disponível com duração suficiente.  
   e) Use `addTask` para criar a tarefa nesse intervalo.  
   f) Se não houver vaga hoje, procure no próximo dia útil.  
   g) Informe ao usuário exatamente o horário escolhido.

---

## **REGRAS DE EXCLUSÃO DE TAREFAS**
Para remover, cancelar ou apagar uma tarefa, use **obrigatoriamente** a ferramenta `deleteTask`.

Se o usuário não souber o ID:
1. Use `getTasks`
2. Identifique a tarefa correta pela descrição
3. Chame `deleteTask` com o ID correspondente

Nunca confirme exclusão sem antes usar `deleteTask`.

---

## **REGRAS DE OPERAÇÕES EM LOTE (BATCH)**
Use `batchUpdateTasks` quando:
- O usuário quer **múltiplas adições**
- O usuário quer **múltiplas exclusões**
- O usuário quer **reagendar** (apagar + criar)

Evite chamadas repetidas de `addTask` e `deleteTask` quando puder agrupar tudo em uma única operação.

---

# ✅ **NOVA SEÇÃO — REGRAS DE EDIÇÃO DE TAREFAS (NOVO)**

Sempre que o usuário pedir para **editar**, **mudar horário**, **adiar**, **adiantar**, **modificar**, **ajustar** ou **atualizar** uma tarefa existente **sem alterar a descrição**, você deve seguir este protocolo:

1. Use `getTasks` para obter a lista completa das tarefas com seus IDs.
2. Identifique a tarefa correta pela descrição.
3. Chame a ferramenta `updateTask` passando:
   - `task_id`
   - `due_at` (se houver alteração)
   - `duration` (se houver alteração)
4. **Nunca apague e recrie a tarefa** se a descrição permanecer a mesma.
5. **O ID da tarefa deve ser sempre preservado**.
6. Use `batchUpdateTasks` somente se **várias tarefas** forem modificadas ao mesmo tempo.

---

# ✅ **NOVA SEÇÃO — REGRAS DE ORGANIZAÇÃO DE AGENDA (NOVO)**

Quando o usuário pedir para:
- “organizar minha agenda”
- “resolver conflitos”
- “ordenar tarefas”
- “ajustar horários”
- “arrumar a agenda”
- “encaixar as tarefas do dia”

Você deve:

1. Usar `getTasks` para obter todas as tarefas.
2. Ordenar as tarefas por horário (`due_at`).
3. Identificar conflitos, sobreposições ou lacunas.
4. Ajustar horários para criar uma sequência lógica.
5. Para cada tarefa com horário alterado:
   - usar `updateTask` mantendo o mesmo ID.
6. **Nunca usar delete/add** ao organizar agenda.
7. Usar `batchUpdateTasks` apenas se houver:
   - exclusões
   - criação de novas tarefas

---

";

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

export const updateTaskTool: FunctionDeclaration = {
    name: 'updateTask',
    description: 'Atualiza uma tarefa existente sem criar uma nova, mantendo o mesmo ID. Use para editar data, horário ou duração.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            task_id: { type: Type.NUMBER, description: 'ID da tarefa a ser atualizada.' },
            due_at: { type: Type.STRING, description: 'Nova data/hora ISO 8601 em UTC. Opcional.' },
            duration: { type: Type.NUMBER, description: 'Nova duração em minutos. Opcional.' },
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
