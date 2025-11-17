import { gapi } from 'gapi-script';







const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;



const SCOPES = 'https://www.googleapis.com/auth/calendar';







let gapiInited = false;



let tokenClient: any = null;







export const initGoogleCalendar = (): Promise<void> => {



  return new Promise((resolve, reject) => {



    if (gapiInited) {



      resolve();



      return;



    }







    if (typeof gapi === 'undefined') {



      reject(new Error('GAPI not loaded'));



      return;



    }







    gapi.load('client', async () => {



      try {



        await gapi.client.init({});







        gapiInited = true;







        if ((window as any).google?.accounts?.oauth2) {



          tokenClient = (window as any).google.accounts.oauth2.initTokenClient({



            client_id: CLIENT_ID,



            scope: SCOPES,



            callback: '',



          });



        }







        resolve();



      } catch (error) {



        console.error('Error initializing Google Calendar:', error);



        gapiInited = false;



        reject(error);



      }



    });



  });



};







export const handleAuthClick = (): Promise<void> => {



  return new Promise((resolve, reject) => {



    if (!tokenClient) {



      reject(new Error('Token client not initialized'));



      return;



    }







    tokenClient.callback = (response: any) => {



      if (response.error) {



        reject(response);



      } else {



        gapi.client.setToken({ access_token: response.access_token });



        resolve();



      }



    };







    if (gapi.client.getToken() === null) {



      tokenClient.requestAccessToken({ prompt: 'consent' });



    } else {



      tokenClient.requestAccessToken({ prompt: '' });



    }



  });



};







export const isSignedIn = (): boolean => {



  const token = gapi.client.getToken();



  return token !== null;



};







export const setCalendarToken = (accessToken: string): void => {



  if (gapi?.client) {



    gapi.client.setToken({ access_token: accessToken });



  }



};







export const handleSignoutClick = () => {



  const token = gapi.client.getToken();



  if (token !== null) {



    (window as any).google.accounts.oauth2.revoke(token.access_token);



    gapi.client.setToken(null);



  }



};







interface CalendarEvent {



  id?: string;



  summary: string;



  description?: string;



  start: {



    dateTime: string;



    timeZone: string;



  };



  end: {



    dateTime: string;



    timeZone: string;



  };



}







export const createCalendarEvent = async (



  title: string,



  description: string,



  startTime: Date,



  durationMinutes: number



): Promise<any> => {



  const token = gapi?.client?.getToken();



  if (!token?.access_token) {



    throw new Error('Google Calendar not authenticated');



  }







  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);







  const event: CalendarEvent = {



    summary: title,



    description: description,



    start: {



      dateTime: startTime.toISOString(),



      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,



    },



    end: {



      dateTime: endTime.toISOString(),



      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,



    },



  };







  try {



    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {



      method: 'POST',



      headers: {



        'Authorization': `Bearer ${token.access_token}`,



        'Content-Type': 'application/json',



      },



      body: JSON.stringify(event),



    });







    if (!response.ok) {



      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));



      throw new Error(`Calendar API error: ${errorData.error?.message || response.statusText}`);



    }







    return await response.json();



  } catch (error) {



    console.error('Error creating calendar event:', error);



    throw error;



  }



};







export const updateCalendarEvent = async (



  eventId: string,



  title: string,



  description: string,



  startTime: Date,



  durationMinutes: number



): Promise<any> => {



  const token = gapi?.client?.getToken();



  if (!token?.access_token) {



    throw new Error('Google Calendar not authenticated');



  }







  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);







  const event: CalendarEvent = {



    summary: title,



    description: description,



    start: {



      dateTime: startTime.toISOString(),



      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,



    },



    end: {



      dateTime: endTime.toISOString(),



      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,



    },



  };







  try {



    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {



      method: 'PUT',



      headers: {



        'Authorization': `Bearer ${token.access_token}`,



        'Content-Type': 'application/json',



      },



      body: JSON.stringify(event),



    });







    if (!response.ok) {



      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));



      throw new Error(`Calendar API error: ${errorData.error?.message || response.statusText}`);



    }







    return await response.json();



  } catch (error) {



    console.error('Error updating calendar event:', error);



    throw error;



  }



};







// --- ESTA É A FUNÇÃO CORRIGIDA ---



// Ela não vai mais travar o app se tentar apagar um evento de "aniversário"



export const deleteCalendarEvent = async (eventId: string): Promise<void> => {



  const token = gapi?.client?.getToken();



  if (!token?.access_token) {



    // Se não estiver logado, apenas avise e saia sem travar



    console.warn('Google Calendar not authenticated, skipping delete.');



    return;



  }







  try {



    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {



      method: 'DELETE',



      headers: {



        'Authorization': `Bearer ${token.access_token}`,



      },



    });







    if (!response.ok) {



      // Se a resposta não for OK (ex: 400), não vamos mais travar o app.



      // Vamos apenas registrar um aviso no console e continuar.



      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));



      console.warn(



        `Falha ao deletar o evento ${eventId} (pode ser um evento especial como 'birthday'): ${errorData.error?.message || response.statusText}`



      );



    }



    // Se a resposta for OK, ele simplesmente termina com sucesso.



  } catch (error) {



    // Também captura erros de rede e apenas registra, sem travar.



    console.error('Erro de rede ao deletar evento do Calendar:', error);



  }



  // Note que não há mais "throw error". A função nunca vai travar o loop.



};



// --- FIM DA FUNÇÃO CORRIGIDA ---











export const getCalendarEvents = async (



  timeMin: Date,



  timeMax: Date



): Promise<any[]> => {



  const token = gapi?.client?.getToken();



  if (!token?.access_token) {



    throw new Error('Google Calendar not authenticated');



  }







  try {



    const params = new URLSearchParams({



      timeMin: timeMin.toISOString(),



      timeMax: timeMax.toISOString(),



      showDeleted: 'false',



      singleEvents: 'true',



      maxResults: '250',



      orderBy: 'startTime',



    });







    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {



      method: 'GET',



      headers: {



        'Authorization': `Bearer ${token.access_token}`,



      },



    });







    if (!response.ok) {



      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));



      throw new Error(`Calendar API error: ${errorData.error?.message || response.statusText}`);



    }







    const data = await response.json();



    return data.items || [];



  } catch (error) {



    console.error('Error fetching calendar events:', error);



    throw error;



  }



};







// Em utils/calendar.ts







export const syncAllEvents = async (



  localTasks: any[],



  onProgress?: (message: string) => void



): Promise<{ 



  synced: number; 



  created: number; 



  updated: number; 



  deleted: number; 



  // ADICIONE ESTA LINHA: Nós retornaremos os IDs para o App.tsx



  updates: { taskId: number; newEventId: string }[]; 



}> => {



  try {



    const now = new Date();



    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);



    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);







    onProgress?.('Buscando eventos do Google Calendar...');



    const calendarEvents = await getCalendarEvents(sixMonthsAgo, oneYearLater);







    let synced = 0;



    let created = 0;



    let updated = 0;



    let deleted = 0;



    // ADICIONE ESTA LINHA: Array para armazenar as atualizações pendentes



    const tasksToUpdate: { taskId: number; newEventId: string }[] = [];







    const calendarEventIds = new Set(calendarEvents.map(e => e.id));



    const localTasksWithDates = localTasks.filter(t => t.due_at && t.id); // Garante que temos um ID







    for (const task of localTasksWithDates) {



      if (task.google_calendar_event_id && calendarEventIds.has(task.google_calendar_event_id)) {



        onProgress?.(`Atualizando: ${task.description}`);



        await updateCalendarEvent(



          task.google_calendar_event_id,



          task.description,



          task.description,



          new Date(task.due_at),



          task.duration || 60



        );



        updated++;



      } else if (!task.google_calendar_event_id) {



        onProgress?.(`Criando: ${task.description}`);



        const event = await createCalendarEvent(



          task.description,



          task.description,



          new Date(task.due_at),



          task.duration || 60



        );



        



        // ADICIONE ESTA LINHA: Salva a atualização pendente



        tasksToUpdate.push({ taskId: task.id, newEventId: event.id });



        



        created++;



        synced++;



      } else {



        synced++;



      }



    }







    const localEventIds = new Set(



      localTasks



        .filter(t => t.google_calendar_event_id)



        .map(t => t.google_calendar_event_id)



    );







    for (const event of calendarEvents) {



      if (!localEventIds.has(event.id)) {



        onProgress?.(`Removendo do Google Calendar: ${event.summary}`);



        // Esta função agora está corrigida e não vai travar



        await deleteCalendarEvent(event.id);



        deleted++;



      }



    }







    onProgress?.('Sincronização completa!');



    // ATUALIZE A LINHA DE RETORNO:



    return { synced, created, updated, deleted, updates: tasksToUpdate };



  } catch (error) {



    console.error('Error syncing all events:', error);



    throw error;



  }



};