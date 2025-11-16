import { gapi } from "gapi-script";

// ===========================
// CONFIGURAÇÕES IMPORTANTES
// ===========================

// ⚠️ URL DA SUA EDGE FUNCTION QUE VAI TROCAR O "code" POR TOKENS
const REDIRECT_URI =
  "https://xshwoyexbpbnnyljizfj.supabase.co/functions/v1/bright-endpoint";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Escopo necessário para usar o Google Calendar
const SCOPES = "https://www.googleapis.com/auth/calendar";

// Estado interno
let gapiInited = false;
let codeClient: any = null;

// ===========================
// TIPAGENS
// ===========================
interface AuthResponse {
  code: string;
  error?: string;
}

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

// ===========================
// INICIALIZAÇÃO DO GAPI
// ===========================
export const initGoogleCalendar = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gapiInited) {
      resolve();
      return;
    }

    if (typeof gapi === "undefined") {
      reject(new Error("GAPI not loaded"));
      return;
    }

    gapi.load("client", async () => {
      try {
        await gapi.client.init({});
        gapiInited = true;

        // Inicializa o Code Client OAuth 2.0
        const google = (window as any).google;
        if (google?.accounts?.oauth2) {
          codeClient = google.accounts.oauth2.initCodeClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            redirect_uri: REDIRECT_URI,
            ux_mode: "popup",
          });
        }

        resolve();
      } catch (error) {
        console.error("Error initializing Google Calendar:", error);
        reject(error);
      }
    });
  });
};

// ===========================
// FLUXO DE LOGIN (Código OAuth)
// ===========================
export const handleAuthClick = (): Promise<AuthResponse> => {
  return new Promise((resolve, reject) => {
    if (!codeClient) {
      reject(new Error("Code client not initialized"));
      return;
    }

    codeClient.callback = (response: any) => {
      if (response.error) {
        reject(response);
      } else {
        resolve(response as AuthResponse);
      }
    };

    codeClient.requestCode({
      access_type: "offline",
      prompt: "consent",
    });
  });
};

// ===========================
// CONTROLE DE SESSÃO
// ===========================
export const isSignedIn = (): boolean => {
  const token = gapi.client.getToken();
  return !!token;
};

export const setCalendarToken = (accessToken: string): void => {
  if (gapi?.client) {
    gapi.client.setToken({ access_token: accessToken });
  }
};

export const handleSignoutClick = () => {
  const token = gapi.client.getToken();

  gapi.client.setToken(null);

  if (token) {
    try {
      (window as any).google.accounts.oauth2.revoke(
        token.access_token,
        () => {
          console.log("Token revogado no Google");
        }
      );
    } catch (e) {
      console.warn("Erro ao revogar token. Ignorando.", e);
    }
  }
};

// ===========================
// CRUD DO GOOGLE CALENDAR
// ===========================
export const createCalendarEvent = async (
  title: string,
  description: string,
  startTime: Date,
  durationMinutes: number
): Promise<any> => {
  const token = gapi?.client?.getToken();
  if (!token?.access_token) throw new Error("Google Calendar not authenticated");

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

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Calendar API error");
  }

  return res.json();
};

export const updateCalendarEvent = async (
  eventId: string,
  title: string,
  description: string,
  startTime: Date,
  durationMinutes: number
): Promise<any> => {
  const token = gapi?.client?.getToken();
  if (!token?.access_token) throw new Error("Google Calendar not authenticated");

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

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Calendar API error");
  }

  return res.json();
};

export const deleteCalendarEvent = async (eventId: string): Promise<void> => {
  const token = gapi?.client?.getToken();
  if (!token?.access_token) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token.access_token}` },
    }
  );
};

export const getCalendarEvents = async (
  timeMin: Date,
  timeMax: Date
): Promise<any[]> => {
  const token = gapi?.client?.getToken();
  if (!token?.access_token) throw new Error("Google Calendar not authenticated");

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    }
  );

  if (!res.ok) throw new Error("Calendar API error");

  const data = await res.json();
  return data.items || [];
};

// ===========================
// SINCRONIZAÇÃO COMPLETA
// ===========================
export const syncAllEvents = async (
  localTasks: any[],
  onProgress?: (m: string) => void
) => {
  try {
    const now = new Date();
    const past = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const calendarEvents = await getCalendarEvents(past, future);
    const calendarEventIds = new Set(calendarEvents.map((e) => e.id));

    let synced = 0;
    let created = 0;
    let updated = 0;
    let deleted = 0;

    const tasksToUpdate: { taskId: number; newEventId: string }[] = [];

    const validTasks = localTasks.filter((t) => t.due_at && t.id);

    for (const task of validTasks) {
      if (
        task.google_calendar_event_id &&
        calendarEventIds.has(task.google_calendar_event_id)
      ) {
        await updateCalendarEvent(
          task.google_calendar_event_id,
          task.description,
          task.description,
          new Date(task.due_at),
          task.duration || 60
        );
        updated++;
      } else if (!task.google_calendar_event_id) {
        const event = await createCalendarEvent(
          task.description,
          task.description,
          new Date(task.due_at),
          task.duration || 60
        );
        created++;
        tasksToUpdate.push({ taskId: task.id, newEventId: event.id });
      }
      synced++;
    }

    const localIds = new Set(
      localTasks
        .filter((t) => t.google_calendar_event_id)
        .map((t) => t.google_calendar_event_id)
    );

    for (const event of calendarEvents) {
      if (!localIds.has(event.id)) {
        await deleteCalendarEvent(event.id);
        deleted++;
      }
    }

    return { synced, created, updated, deleted, updates: tasksToUpdate };
  } catch (error) {
    console.error("syncAllEvents error:", error);
    throw error;
  }
};
