import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import * as jose from 'https://esm.sh/jose@5.9.6';
import { corsHeaders } from '../_shared/cors.ts';

const SITE_URL = 'sc-domain:upriseremodeling.com';
const API_BASE = 'https://www.googleapis.com/webmasters/v3/sites';

async function getAccessToken(): Promise<string> {
  const raw = Deno.env.get('GSC_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('GSC_SERVICE_ACCOUNT_JSON not configured');
  const sa = JSON.parse(raw);

  const now = Math.floor(Date.now() / 1000);
  const key = await jose.importPKCS8(sa.private_key, 'RS256');
  const jwt = await new jose.SignJWT({
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function query(token: string, body: unknown) {
  const url = `${API_BASE}/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GSC query ${res.status}: ${await res.text()}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '28', 10);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // GSC data lags ~2 days
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const token = await getAccessToken();
    const range = { startDate: isoDate(startDate), endDate: isoDate(endDate) };

    const [totals, topQueries, topPages] = await Promise.all([
      query(token, { ...range, dimensions: [], rowLimit: 1 }),
      query(token, { ...range, dimensions: ['query'], rowLimit: 10 }),
      query(token, { ...range, dimensions: ['page'], rowLimit: 10 }),
    ]);

    const totalRow = totals.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    return new Response(
      JSON.stringify({
        range,
        totals: {
          clicks: totalRow.clicks,
          impressions: totalRow.impressions,
          ctr: totalRow.ctr,
          position: totalRow.position,
        },
        top_queries: (topQueries.rows || []).map((r: any) => ({
          query: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        })),
        top_pages: (topPages.rows || []).map((r: any) => ({
          page: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
