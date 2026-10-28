// api/generate_qr_gateway.js
// Chamado por todas as páginas /up1/1/ até /up10/10/ para gerar PIX de upsell
// Recebe: { amount, nome, email, phone, ... }
// Retorna: { payment_code, pix_code, id, price_label }

const SUNIZE_API_KEY    = process.env.SUNIZE_API_KEY    || 'ck_09b9220395401d898ac900b899f3b9a8';
const SUNIZE_API_SECRET = process.env.SUNIZE_API_SECRET || 'cs_e6492916572e976687cac7fc591d3e5f';
const SUNIZE_BASE       = 'https://api.sunize.com.br/v2';

// Valor mínimo aceito pela Sunize
const VALOR_MINIMO = 5.00;

function fmtBRL(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      amount,
      nome,
      email,
      phone,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      reference
    } = req.body || {};

    // Valida amount
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount < VALOR_MINIMO) {
      return res.status(400).json({ error: `Valor mínimo é R$ ${VALOR_MINIMO.toFixed(2)}` });
    }

    const name  = (nome || 'Cliente').trim();
    const mail  = (email || '').toLowerCase().trim();
    const phoneClear = String(phone || '').replace(/\D/g, '');
    const phoneE164  = phoneClear
      ? (phoneClear.startsWith('55') ? `+${phoneClear}` : `+55${phoneClear}`)
      : '+5511999999999'; // fallback se não vier

    // external_id: determinístico por email+amount para suportar reaproveitamento Sunize
    const emailKey   = mail ? Buffer.from(mail).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 16) : 'anon';
    const amountKey  = String(Math.round(parsedAmount * 100));
    const externalId = `up_${emailKey}_${amountKey}_${Date.now()}`;

    const sunizeBody = {
      external_id:    externalId,
      amount:         parsedAmount,
      payment_method: 'PIX',
      items: [
        {
          id:          `taxa_up_${amountKey}`,
          title:       'Taxa de Liberação de Saldo',
          description: 'Pagamento de taxa para liberação',
          price:       parsedAmount,
          quantity:    1,
          is_physical: false
        }
      ],
      ip:       req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1',
      customer: {
        name:          name,
        email:         mail || `cliente_${Date.now()}@tiktok.temp`,
        phone:         phoneE164,
        document_type: 'CPF',
        document:      phoneClear.slice(0, 11).padEnd(11, '0')
      }
    };

    // Adiciona tracking se disponível
    if (utm_source || utm_medium || utm_campaign || utm_term || utm_content) {
      sunizeBody.tracking = {
        utm_source:   utm_source   || null,
        utm_medium:   utm_medium   || null,
        utm_campaign: utm_campaign || null,
        utm_term:     utm_term     || null,
        utm_content:  utm_content  || null
      };
    }

    const sunizeRes = await fetch(`${SUNIZE_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     SUNIZE_API_KEY,
        'x-api-secret':  SUNIZE_API_SECRET
      },
      body: JSON.stringify(sunizeBody)
    });

    const sunizeData = await sunizeRes.json();

    if (!sunizeRes.ok || sunizeData.hasError) {
      console.error('[generate_qr_gateway] Sunize erro:', JSON.stringify(sunizeData));
      return res.status(400).json({ error: sunizeData.message || 'Erro ao gerar PIX' });
    }

    const pixPayload = sunizeData.pix?.payload || '';

    return res.status(200).json({
      payment_code: externalId,
      pix_code:     pixPayload,
      id:           sunizeData.id,
      price_label:  fmtBRL(parsedAmount),
      status:       sunizeData.status,
      reused:       sunizeData.reused || false
    });

  } catch (err) {
    console.error('[generate_qr_gateway] Erro interno:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
