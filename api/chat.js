// RAG chat: embed query (Voyage) -> retrieve (Supabase pgvector) -> generate (DeepSeek)
const readBody = (req) => new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d)); });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: ANON, VOYAGE_API_KEY: VOY, DEEPSEEK_API_KEY: DS } = process.env;
  if (!SUPA || !ANON || !VOY || !DS) return res.status(500).json({ error: 'Server not configured yet.' });

  let q = '';
  try { q = String((JSON.parse((await readBody(req)) || '{}').message) || '').trim().slice(0, 500); } catch (_) {}
  if (!q) return res.status(400).json({ error: 'message required' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const rpc = (fn, body) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(body),
  });

  // per-IP rate gate (fail-open if the gate errors)
  try {
    const allowed = await (await rpc('rag_gate', { p_ip: ip, p_question: q, p_limit: 12 })).json();
    if (allowed === false) return res.status(429).json({ answer: "You're going a bit fast — give it a few seconds and ask again." });
  } catch (_) {}

  // embed the question with Voyage (asymmetric: query type)
  const rateMsg = "I'm on a free-tier rate limit right now (a few requests per minute) — give it about 20 seconds and ask me again. 🙂";
  let embedding;
  try {
    const er = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOY}` },
      body: JSON.stringify({ model: 'voyage-3.5-lite', input: [q], input_type: 'query', output_dimension: 1024 }),
    });
    if (er.status === 429) return res.status(200).json({ answer: rateMsg });
    const txt = await er.text();
    if (!er.ok) { if (/rate limit|\bRPM\b|TPM/i.test(txt)) return res.status(200).json({ answer: rateMsg }); throw new Error(txt); }
    embedding = JSON.parse(txt).data[0].embedding;
  } catch (e) {
    if (/rate limit|\bRPM\b|TPM|429/i.test(String(e && e.message))) return res.status(200).json({ answer: rateMsg });
    return res.status(502).json({ error: 'embedding failed' });
  }

  // retrieve top-k chunks from pgvector
  let chunks = [];
  try { const r = await rpc('match_documents', { query_embedding: embedding, match_count: 8 }); const j = await r.json(); if (Array.isArray(j)) chunks = j; } catch (_) {}
  const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

  const system =
    "You are the portfolio assistant for Andi Sharil Azwan, an AI Automation Engineer. " +
    "Answer questions about Andi — his work, projects, skills, experience, and how to contact him — using ONLY the CONTEXT below. " +
    "Never use outside knowledge and never invent facts, numbers, employers, clients, or superlatives. " +
    "Respect explicit labels in the context: only call a project the 'flagship' (or main/biggest) if the context literally says so. " +
    "If the answer is not in the context, say you don't have that detail and point them to andisharil1234@gmail.com. " +
    "Be concise, warm, and specific; use short paragraphs or bullets. Speak about Andi in the third person. Match the user's language (English or Bahasa Melayu). " +
    "Politely decline anything unrelated to Andi's professional profile.\n\nCONTEXT:\n" +
    (context || '(no context retrieved)');

  try {
    const dr = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DS}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [ { role: 'system', content: system }, { role: 'user', content: q } ],
        max_tokens: 450,
        temperature: 0.3,
      }),
    });
    if (!dr.ok) throw new Error(await dr.text());
    const answer = (await dr.json()).choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
    return res.status(200).json({ answer });
  } catch (e) { return res.status(502).json({ error: 'generation failed' }); }
};
