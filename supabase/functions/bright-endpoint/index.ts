import { createClient } from "npm:@supabase/supabase-js@2.42.6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const REDIRECT_URI = Deno.env.get("REDIRECT_URI") || `${SUPABASE_URL}/functions/v1/get-calendar-token`;
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Credentials": "true"
};

async function validateJwtAndGetUser(bearerToken: string) {
  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/user`;
  const r = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      apikey: SUPABASE_ANON_KEY
    }
  });
  if (!r.ok) {
    console.log("Invalid JWT:", r.status);
    return null;
  }
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const bearer = authHeader.slice(7).trim();
    const user = await validateJwtAndGetUser(bearer);
    if (!user || !user.id) {
      return new Response(JSON.stringify({ error: "Invalid Supabase token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => null);
    const { code, userId } = body || {};
    if (!code || !userId) {
      return new Response(JSON.stringify({ error: "Missing code or userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: "userId mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    console.log("Google token exchange:", {
      ok: tokenRes.ok,
      status: tokenRes.status,
      redirectUri: REDIRECT_URI
    });

    if (!tokenRes.ok) {
      return new Response(JSON.stringify({
        error: "Google token exchange failed",
        status: tokenRes.status,
        details: tokenData,
        redirect_uri_used: REDIRECT_URI
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const expiresAt = tokenData.expires_in != null
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const { error: upError } = await supabase
      .from("google_calendar_tokens")
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });

    if (upError) {
      console.error("Upsert error:", upError);
      return new Response(JSON.stringify({ error: upError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      accessToken: tokenData.access_token,
      expiresAt
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({
      error: "Unexpected error",
      details: String(err)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});