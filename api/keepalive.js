// Keep-alive: a daily Vercel cron hits this to run one trivial query against
// Supabase, resetting the free-tier 7-day inactivity timer so the project never
// auto-pauses (which silently breaks the RAG chatbot's retrieval).
module.exports = async function handler(req, res) {
  const { SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: ANON } = process.env;
  if (!SUPA || !ANON) return res.status(200).json({ ok: false, error: 'not configured' });
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/match_documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ query_embedding: new Array(1024).fill(0), match_count: 1 }),
    });
    return res.status(200).json({ ok: r.ok, pinged: 'supabase', status: r.status });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
};
