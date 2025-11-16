import { useEffect, useState } from "react";
import { supabase } from "scr/services/supabaseClient.ts";

export default function GoogleCalendarAuth() {
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkAuth() {
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: { action: "check-auth" }
    });

    if (error) {
      console.error("Erro check-auth:", error);
      setError("Erro ao verificar autenticação.");
      setLoading(false);
      return;
    }

    setIsConnected(data?.connected === true);
    setLoading(false);
  }

  async function login() {
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: { action: "auth-url" }
    });

    if (error || !data?.url) {
      console.error("Erro auth-url:", error);
      setError("Erro ao gerar URL de autenticação.");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  async function logout() {
    setLoading(true);

    const { error } = await supabase.functions.invoke("google-calendar", {
      body: { action: "logout" }
    });

    if (error) {
      console.error("Erro logout:", error);
      setError("Erro ao desconectar.");
      setLoading(false);
      return;
    }

    setIsConnected(false);
    setLoading(false);
  }

  useEffect(() => {
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-gray-100 rounded-md text-gray-700">
        Verificando autenticação…
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border rounded-md shadow">
      <h2 className="font-semibold text-lg">Google Calendar</h2>

      {error && (
        <p className="text-red-500 mt-2">
          {error}
        </p>
      )}

      {!isConnected ? (
        <button
          onClick={login}
          className="mt-3 bg-green-600 text-white px-4 py-2 rounded"
        >
          Conectar ao Google Calendar
        </button>
      ) : (
        <div className="mt-4">
          <p className="text-green-600">Google Calendar conectado ✔</p>

          <button
            onClick={logout}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded"
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  );
}
