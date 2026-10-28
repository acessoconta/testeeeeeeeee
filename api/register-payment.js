// api/register-payment.js
// Stub de tracking — vincula session_id à transação (usado pelo agTracker)
// Não é crítico para o pagamento; responde 200 sempre.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Log para debug (opcional)
  try {
    const body = req.body || {};
    console.log('[register-payment]', JSON.stringify(body));
  } catch (_) {}

  return res.status(200).json({ ok: true });
}
