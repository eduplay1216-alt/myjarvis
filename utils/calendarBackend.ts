import { supabase } from '../src/services/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function checkCalendarAuth(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-calendar-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'check-auth' })
    });

    const data = await response.json();
    return data.connected === true;
  } catch (error) {
    console.error('Error checking calendar auth:', error);
    return false;
  }
}

export async function getCalendarAuthUrl(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('User not authenticated');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-calendar-token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'auth-url' })
  });

  const data = await response.json();
  return data.url;
}

export async function logoutCalendar(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-calendar-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'logout' })
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error logging out calendar:', error);
    return false;
  }
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresAt: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id || !session.access_token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/bright-endpoint`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      userId: session.user.id
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to exchange code for token');
  }

  return await response.json();
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;

    const { data } = await supabase
      .from('google_calendar_tokens')
      .select('access_token, expires_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!data?.access_token) return null;

    if (data.expires_at) {
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        return null;
      }
    }

    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

export async function createCalendarEvent(
  title: string,
  description: string,
  startTime: Date,
  durationMinutes: number
): Promise<any> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Google Calendar not authenticated');
  }

  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  const event = {
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

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Calendar API error: ${errorData.error?.message || response.statusText}`);
  }

  return await response.json();
}

export async function updateCalendarEvent(
  eventId: string,
  title: string,
  description: string,
  startTime: Date,
  durationMinutes: number
): Promise<any> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Google Calendar not authenticated');
  }

  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  const event = {
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

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Calendar API error: ${errorData.error?.message || response.statusText}`);
  }

  return await response.json();
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    console.warn('Google Calendar not authenticated, skipping delete.');
    return;
  }

  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn(
        `Falha ao deletar o evento ${eventId} (pode ser um evento especial como 'birthday'): ${errorData.error?.message || response.statusText}`
      );
    }
  } catch (error) {
    console.error('Erro de rede ao deletar evento do Calendar:', error);
  }
}

export async function getCalendarEvents(timeMin: Date, timeMax: Date): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Google Calendar not authenticated');
  }

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
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Calendar API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

export async function syncAllEvents(
  localTasks: any[],
  onProgress?: (message: string) => void
): Promise<{
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  updates: { taskId: number; newEventId: string }[];
}> {
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
    const tasksToUpdate: { taskId: number; newEventId: string }[] = [];

    const calendarEventIds = new Set(calendarEvents.map(e => e.id));
    const localTasksWithDates = localTasks.filter(t => t.due_at && t.id);

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
        await deleteCalendarEvent(event.id);
        deleted++;
      }
    }

    onProgress?.('Sincronização completa!');
    return { synced, created, updated, deleted, updates: tasksToUpdate };
  } catch (error) {
    console.error('Error syncing all events:', error);
    throw error;
  }
}
