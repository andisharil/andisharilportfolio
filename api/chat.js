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
  let embedding;
  try {
    const er = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOY}` },
      body: JSON.stringify({ model: 'voyage-3.5-lite', input: [q], input_type: 'query', output_dimension: 1024 }),
    });
    if (!er.ok) throw new Error(await er.text());
    embedding = (await er.json()).data[0].embedding;
  } catch (e) { return res.status(502).json({ error: 'embedding failed' }); }

  // retrieve top-k chunks from pgvector
  let chunks = [];
  try { const r = await rpc('match_documents', { query_embedding: embedding, match_count: 5 }); const j = await r.json(); if (Array.isArray(j)) chunks = j; } catch (_) {}
  const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

  const system =
    "You are the portfolio assistant for Andi Sharil Azwan, an AI Automation Engineer. " +
    "Answer questions about Andi — his work, projects, skills, experience, and how to contact him — using ONLY the CONTEXT below. " +
    "Be concise, warm, and specific; use short paragraphs or bullets. Speak about Andi in the third person. Match the user's language (English or Bahasa Melayu). " +
    "If the answer is not in the context, say you don't have that detail and point them to andisharil1234@gmail.com. " +
    "Never invent facts, numbers, employers, or clients. Politely decline anything unrelated to Andi's professional profile.\n\nCONTEXT:\n" +
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
