import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];

let gapiInited = false;
let gisInited = false;

export const initGoogleCalendar = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gapiInited) {
      resolve();
      return;
    }

    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};

export const handleAuthClick = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          reject(response);
        } else {
          resolve();
        }
      },
    });

    tokenClient.requestAccessToken();
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
