// ==========================================================
// Vercel Serverless Function: Verificación Server-Side de Pagos en Mercado Pago
// ==========================================================

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-2016510188747825-083012-74eb27bde427365b0267e93f06601159-1169129348';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { payment_id } = body;

        const cleanPaymentId = String(payment_id || '').trim();
        if (!cleanPaymentId || !/^\d+$/.test(cleanPaymentId)) {
            return res.status(400).json({ verified: false, error: 'ID de pago inválido o inexistente' });
        }

        // Consultar directamente a la API oficial de Mercado Pago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${cleanPaymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!mpRes.ok) {
            const errorData = await mpRes.json().catch(() => ({}));
            return res.status(mpRes.status || 400).json({
                verified: false,
                error: 'No se pudo verificar el pago con Mercado Pago',
                details: errorData
            });
        }

        const payment = await mpRes.json();

        // Validaciones estrictas de seguridad
        const isApproved = payment.status === 'approved';
        const isAccredited = payment.status_detail === 'accredited';
        const verifiedAmount = Number(payment.transaction_amount || 0);

        if (!isApproved || verifiedAmount <= 0) {
            return res.status(200).json({
                verified: false,
                status: payment.status,
                status_detail: payment.status_detail,
                error: 'El pago aún no se encuentra aprobado o acreditado'
            });
        }

        return res.status(200).json({
            verified: true,
            payment_id: String(payment.id),
            status: payment.status,
            status_detail: payment.status_detail,
            amount: verifiedAmount,
            date_approved: payment.date_approved,
            payment_type: payment.payment_type_id,
            payment_method: payment.payment_method_id,
            external_reference: payment.external_reference
        });
    } catch (err) {
        console.error('Verify Payment Serverless Error:', err);
        return res.status(500).json({ verified: false, error: err.message || 'Error interno al verificar pago' });
    }
}
