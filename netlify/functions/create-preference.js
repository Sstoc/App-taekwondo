// ==========================================================
// Netlify Function: Crear Preferencia de Mercado Pago (Checkout Pro)
// ==========================================================

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-2016510188747825-083012-74eb27bde427365b0267e93f06601159-1169129348';

exports.handler = async (event) => {
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
        const { student_id, student_name, amount, type, origin_url } = body;

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Monto inválido para el pago' })
            };
        }

        const isExamen = type === 'examen';
        const title = isExamen
            ? `Derecho a Examen - Taekwondo CMK (${student_name || 'Alumno'})`
            : `Cuota Mensual - Taekwondo CMK (${student_name || 'Alumno'})`;

        const baseUrl = (origin_url && origin_url.startsWith('https://') && !origin_url.includes('localhost'))
            ? origin_url.replace(/\/$/, '')
            : 'https://apptaekwondo.netlify.app';

        const preferencePayload = {
            items: [
                {
                    id: isExamen ? `tkd-examen-${student_id}` : `tkd-cuota-${student_id}`,
                    title: title,
                    description: isExamen ? 'Pago de mesa de examen de Taekwondo' : 'Pago de cuota mensual de Taekwondo Chang Moo Kwan',
                    quantity: 1,
                    currency_id: 'ARS',
                    unit_price: numAmount
                }
            ],
            payer: {
                name: student_name || 'Alumno'
            },
            back_urls: {
                success: `${baseUrl}/?mp_status=approved&type=${encodeURIComponent(type || 'cuota')}&student_id=${encodeURIComponent(student_id || '')}&amount=${numAmount}`,
                failure: `${baseUrl}/?mp_status=failure`,
                pending: `${baseUrl}/?mp_status=pending`
            },
            auto_return: 'approved',
            binary_mode: true,
            statement_descriptor: 'TKD CMK',
            external_reference: `${student_id || 'general'}-${Date.now()}`
        };

        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(preferencePayload)
        });

        const mpData = await mpRes.json();

        if (!mpRes.ok || !mpData.init_point) {
            console.error('Mercado Pago API Error:', mpData);
            return {
                statusCode: mpRes.status || 500,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: mpData.message || 'Error al generar preferencia en Mercado Pago',
                    details: mpData
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
                id: mpData.id,
                init_point: mpData.init_point,
                sandbox_init_point: mpData.sandbox_init_point
            })
        };
    } catch (err) {
        console.error('Serverless Error:', err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: err.message || 'Error interno del servidor' })
        };
    }
};
