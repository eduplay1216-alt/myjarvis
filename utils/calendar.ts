import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];

let gapiInited = false;
let tokenClient: any = null;

export const initGoogleCalendar = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gapiInited) {
      resolve();
      return;
    }

    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS,
        });
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
    const response = await gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    return response.result;
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
    const response = await gapi.client.calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: event,
    });
    return response.result;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
};

export const deleteCalendarEvent = async (eventId: string): Promise<void> => {
  try {
    await gapi.client.calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
};

export const getCalendarEvents = async (
  timeMin: Date,
  timeMax: Date
): Promise<any[]> => {
  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 250,
      orderBy: 'startTime',
    });
    return response.result.items || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
};

export const syncAllEvents = async (
  localTasks: any[],
  onProgress?: (message: string) => void
): Promise<{ synced: number; created: number; updated: number; deleted: number }> => {
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

    const calendarEventIds = new Set(calendarEvents.map(e => e.id));
    const localTasksWithDates = localTasks.filter(t => t.due_at);

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
        await deleteCalendarEvent(event.id);
        deleted++;
      }
    }

    onProgress?.('Sincronização completa!');
    return { synced, created, updated, deleted };
  } catch (error) {
    console.error('Error syncing all events:', error);
    throw error;
  }
};
