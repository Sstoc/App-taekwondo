// ==========================================================
// Netlify Function: Verificación Server-Side de Pagos en Mercado Pago
// ==========================================================

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-2016510188747825-083012-74eb27bde427365b0267e93f06601159-1169129348';

export const handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { payment_id } = body;

        const cleanPaymentId = String(payment_id || '').trim();
        if (!cleanPaymentId || !/^\d+$/.test(cleanPaymentId)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ verified: false, error: 'ID de pago inválido o inexistente' })
            };
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
            return {
                statusCode: mpRes.status || 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    verified: false,
                    error: 'No se pudo verificar el pago con Mercado Pago',
                    details: errorData
                })
            };
        }

        const payment = await mpRes.json();

        // Validaciones estrictas de seguridad
        const isApproved = payment.status === 'approved';
        const isAccredited = payment.status_detail === 'accredited';
        const verifiedAmount = Number(payment.transaction_amount || 0);

        if (!isApproved || verifiedAmount <= 0) {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    verified: false,
                    status: payment.status,
                    status_detail: payment.status_detail,
                    error: 'El pago aún no se encuentra aprobado o acreditado'
                })
            };
        }

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                verified: true,
                payment_id: String(payment.id),
                status: payment.status,
                status_detail: payment.status_detail,
                amount: verifiedAmount,
                date_approved: payment.date_approved,
                payment_type: payment.payment_type_id,
                payment_method: payment.payment_method_id,
                external_reference: payment.external_reference
            })
        };
    } catch (err) {
        console.error('Verify Payment Serverless Error:', err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ verified: false, error: err.message || 'Error interno al verificar pago' })
        };
    }
};
