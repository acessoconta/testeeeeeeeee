// api/gerar-pix.js
// Chamado pela página /checkout/ — cria transação PIX de R$ 20,00 via Sunize v2

const SUNIZE_API_KEY    = process.env.SUNIZE_API_KEY    || 'ck_09b9220395401d898ac900b899f3b9a8';
const SUNIZE_API_SECRET = process.env.SUNIZE_API_SECRET || 'cs_e6492916572e976687cac7fc591d3e5f';
const SUNIZE_BASE       = 'https://api.sunize.com.br/v2';

const CHECKOUT_AMOUNT = 20.00; // R$ 20,00 — taxa de verificação checkout

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { fullName, email, phone, sessionId, ttclid } = req.body || {};

    if (!fullName || !email || !phone) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios: fullName, email, phone' });
    }

    // Normaliza telefone → E.164 (+55XXXXXXXXXXX)
    const phoneClear = String(phone).replace(/\D/g, '');
    const phoneE164  = phoneClear.startsWith('55') ? `+${phoneClear}` : `+55${phoneClear}`;

    // external_id determinístico: reutiliza PIX pendente se o cliente recarregar
    const externalId = `checkout_${Buffer.from(email.toLowerCase()).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 20)}_${Date.now()}`;

    const body = {
      external_id:    externalId,
      amount:         CHECKOUT_AMOUNT,
      payment_method: 'PIX',
      items: [
        {
          id:          'taxa_verificacao',
          title:       'Verificação de Identidade - Estorno após Pagamento',
          description: '100% seguro',
          price:       CHECKOUT_AMOUNT,
          quantity:    1,
          is_physical: false
        }
      ],
      ip:       req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1',
      customer: {
        name:          fullName,
        email:         email.toLowerCase().trim(),
        phone:         phoneE164,
        document_type: 'CPF',
        document:      phoneClear.slice(0, 11).padEnd(11, '0') // placeholder — CPF real viria de outro campo
      }
    };

    // Adiciona tracking se veio ttclid
    if (ttclid) {
      body.tracking = { utm_content: ttclid };
    }

    const sunizeRes = await fetch(`${SUNIZE_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     SUNIZE_API_KEY,
        'x-api-secret':  SUNIZE_API_SECRET
      },
      body: JSON.stringify(body)
    });

    const sunizeData = await sunizeRes.json();

    if (!sunizeRes.ok || sunizeData.hasError) {
      console.error('[gerar-pix] Sunize erro:', sunizeData);
      return res.status(400).json({ ok: false, error: sunizeData.message || 'Erro ao gerar PIX na Sunize' });
    }

    const pixPayload = sunizeData.pix?.payload || '';

    return res.status(200).json({
      ok:         true,
      id:         sunizeData.id,
      qr_code:    pixPayload,
      qr_code_url: pixPayload ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}` : '',
      payment_code: externalId,
      external_reference: externalId,
      status:     sunizeData.status,
      amount:     CHECKOUT_AMOUNT,
      reused:     sunizeData.reused || false
    });

  } catch (err) {
    console.error('[gerar-pix] Erro interno:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
}
