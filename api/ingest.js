// Ingest: batch-embed all KB chunks with Voyage (one request) -> insert into pgvector.
// Protected by INGEST_SECRET header. Body: { chunks: [{title, content}], clear?: true }
const readBody = (req) => new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d)); });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: ANON, VOYAGE_API_KEY: VOY, INGEST_SECRET } = process.env;
  if (!SUPA || !ANON || !VOY || !INGEST_SECRET) return res.status(500).json({ error: 'Server not configured yet.' });
  if (req.headers['x-ingest-secret'] !== INGEST_SECRET) return res.status(401).json({ error: 'unauthorized' });

  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); } catch (_) { return res.status(400).json({ error: 'bad json' }); }
  if (!Array.isArray(body.chunks) || !body.chunks.length) return res.status(400).json({ error: 'chunks[] required' });

  const items = body.chunks
    .map((ch) => ({ title: ch.title || null, content: (ch.title ? ch.title + '\n' : '') + (ch.content || '') }))
    .filter((x) => x.content.trim());

  const rpc = (fn, b) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(b),
  });

  // ONE batched Voyage request for all chunks (stays within the 3 RPM free tier)
  let embs;
  try {
    const r = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOY}` },
      body: JSON.stringify({ model: 'voyage-3.5-lite', input: items.map((x) => x.content), input_type: 'document', output_dimension: 1024 }),
    });
    if (!r.ok) throw new Error('embed: ' + (await r.text()));
    const data = (await r.json()).data || [];
    embs = new Array(items.length);
    for (const d of data) embs[d.index] = d.embedding;
    if (embs.some((e) => !Array.isArray(e) || e.length !== 1024)) throw new Error('unexpected embeddings');
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }

  try {
    if (body.clear) { const c = await rpc('clear_documents', {}); if (!c.ok) throw new Error('clear: ' + (await c.text())); }
    let inserted = 0;
    for (let i = 0; i < items.length; i++) {
      const ins = await rpc('insert_document', { p_content: items[i].content, p_metadata: { title: items[i].title }, p_embedding: embs[i] });
      if (!ins.ok) throw new Error('insert: ' + (await ins.text()));
      inserted++;
    }
    return res.status(200).json({ ok: true, inserted });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
};
