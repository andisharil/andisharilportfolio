// One-time/occasional ingest: embed KB chunks (OpenAI) -> insert into Supabase pgvector.
// Protected by INGEST_SECRET header. Body: { chunks: [{title, content}], clear?: true }
const readBody = (req) => new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d)); });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: ANON, OPENAI_API_KEY: OAI, INGEST_SECRET } = process.env;
  if (!SUPA || !ANON || !OAI || !INGEST_SECRET) return res.status(500).json({ error: 'Server not configured yet.' });
  if (req.headers['x-ingest-secret'] !== INGEST_SECRET) return res.status(401).json({ error: 'unauthorized' });

  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); } catch (_) { return res.status(400).json({ error: 'bad json' }); }
  const chunks = body.chunks;
  if (!Array.isArray(chunks) || !chunks.length) return res.status(400).json({ error: 'chunks[] required' });

  const rpc = (fn, b) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(b),
  });
  const embed = async (text) => {
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OAI}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    });
    if (!r.ok) throw new Error('embed: ' + (await r.text()));
    return (await r.json()).data[0].embedding;
  };

  try {
    if (body.clear) { const c = await rpc('clear_documents', {}); if (!c.ok) throw new Error('clear: ' + (await c.text())); }
    let inserted = 0;
    for (const ch of chunks) {
      const content = (ch.title ? ch.title + '\n' : '') + (ch.content || '');
      if (!content.trim()) continue;
      const emb = await embed(content);
      const ins = await rpc('insert_document', { p_content: content, p_metadata: { title: ch.title || null }, p_embedding: emb });
      if (!ins.ok) throw new Error('insert: ' + (await ins.text()));
      inserted++;
    }
    return res.status(200).json({ ok: true, inserted });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
};
