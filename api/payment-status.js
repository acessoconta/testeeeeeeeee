// api/payment-status.js
// Chamado pelas páginas /up1/1/ ... /up10/10/ para polling do status do PIX
// Parâmetro: ?code=<sunize_transaction_id>
// Retorna: { status: 'approved' | 'pending' | 'failed' }

const SUNIZE_API_KEY    = process.env.SUNIZE_API_KEY    || 'ck_09b9220395401d898ac900b899f3b9a8';
const SUNIZE_API_SECRET = process.env.SUNIZE_API_SECRET || 'cs_e6492916572e976687cac7fc591d3e5f';
const SUNIZE_BASE       = 'https://api.sunize.com.br/v2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const code = req.query?.code;
  if (!code) {
    return res.status(400).json({ status: 'pending', error: 'Parâmetro code obrigatório' });
  }

  try {
    const sunizeRes = await fetch(`${SUNIZE_BASE}/transactions/${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: {
        'x-api-key':    SUNIZE_API_KEY,
        'x-api-secret': SUNIZE_API_SECRET
      }
    });

    const data = await sunizeRes.json();

    if (!sunizeRes.ok) {
      // Pode ser que o code seja o external_id — Sunize usa transaction_id no path
      // Se falhar, retorna pending sem travar o polling
      return res.status(200).json({ status: 'pending' });
    }

    // Páginas up1-10 checam: data.status === 'approved' || data.paid === true || data.status === 'paid'
    const isApproved = data.status === 'AUTHORIZED' || data.status === 'PAID';
    const isFailed   = data.status === 'FAILED' || data.status === 'CHARGEBACK';

    return res.status(200).json({
      status:  isApproved ? 'approved' : isFailed ? 'failed' : 'pending',
      paid:    isApproved,
      raw:     data.status
    });

  } catch (err) {
    console.error('[payment-status] Erro:', err);
    return res.status(200).json({ status: 'pending' });
  }
}
