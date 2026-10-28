// api/consultar-pix.js
// Chamado pela página /checkout/ para verificar status do PIX (polling a cada 4s)
// Parâmetro: ?id=<transaction_id_sunize>

const SUNIZE_API_KEY    = process.env.SUNIZE_API_KEY    || 'ck_09b9220395401d898ac900b899f3b9a8';
const SUNIZE_API_SECRET = process.env.SUNIZE_API_SECRET || 'cs_e6492916572e976687cac7fc591d3e5f';
const SUNIZE_BASE       = 'https://api.sunize.com.br/v2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query?.id;
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Parâmetro id obrigatório' });
  }

  try {
    const sunizeRes = await fetch(`${SUNIZE_BASE}/transactions/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        'x-api-key':    SUNIZE_API_KEY,
        'x-api-secret': SUNIZE_API_SECRET
      }
    });

    const data = await sunizeRes.json();

    if (!sunizeRes.ok) {
      return res.status(200).json({ ok: false, status: 'pending', error: data.message });
    }

    // Checkout espera: data.ok && data.status === 'approved'
    const isApproved = data.status === 'AUTHORIZED' || data.status === 'PAID';

    return res.status(200).json({
      ok:     true,
      status: isApproved ? 'approved' : 'pending',
      raw:    data.status
    });

  } catch (err) {
    console.error('[consultar-pix] Erro:', err);
    return res.status(200).json({ ok: false, status: 'pending' });
  }
}
