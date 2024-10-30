const { Client } = require('@notionhq/client');
const axios = require('axios');

// Configuración de las variables de entorno
const CLOCKIFY_API_KEY = process.env.CLOCKIFY_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const SOLEST_PAGE_ID = process.env.SOLEST_PAGE_ID;
const CLOCKIFY_PROJECT_ID = process.env.CLOCKIFY_PROJECT_ID;
const WORKSPACE_ID = process.env.WORKSPACE_ID;

// Inicializar cliente de Notion
const notion = new Client({ auth: NOTION_TOKEN });

// Función para obtener las horas de Clockify
async function getClockifyHours() {
    try {
        console.log('Intentando conectar con Clockify...');

        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 12);

        // Modificamos el request para usar el endpoint de reportes detallados
        const requestBody = {
            dateRangeStart: startDate.toISOString(),
            dateRangeEnd: endDate.toISOString(),
            detailedFilter: {
                page: 1,
                pageSize: 1000, // Aumentamos el tamaño de página para asegurar obtener todos los registros
                sortColumn: "DATE"
            },
            projects: {
                ids: [CLOCKIFY_PROJECT_ID],
                contains: "CONTAINS"
            }
        };

        console.log('Request Body:', JSON.stringify(requestBody, null, 2));

        // Usamos el endpoint de reportes detallados en lugar del summary
        const response = await axios.post(
            `https://reports.api.clockify.me/v1/workspaces/${WORKSPACE_ID}/reports/detailed`,
            requestBody,
            {
                headers: {
                    'X-Api-Key': CLOCKIFY_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Respuesta de Clockify recibida');

        let totalMilliseconds = 0;

        // Sumamos la duración de todas las entradas de tiempo
        if (response.data.timeentries && response.data.timeentries.length > 0) {
            totalMilliseconds = response.data.timeentries.reduce((total, entry) => {
                // Convertimos la duración de cada entrada (que viene en PTxHxMxS format) a millisegundos
                const duration = entry.timeInterval.duration;
                const hours = duration.match(/(\d+)H/)?.[1] || 0;
                const minutes = duration.match(/(\d+)M/)?.[1] || 0;
                const seconds = duration.match(/(\d+)S/)?.[1] || 0;
                
                return total + (hours * 3600000 + minutes * 60000 + seconds * 1000);
            }, 0);
        }

        // Convertimos millisegundos a horas y redondeamos a 2 decimales
        const hours = Number((totalMilliseconds / (1000 * 60 * 60)).toFixed(2));
        
        console.log('Total horas calculadas:', hours);
        return hours;
    } catch (error) {
        console.error('Error detallado de Clockify:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            headers: error.response?.headers
        });
        throw new Error(`Error de Clockify: ${error.message}`);
    }
}

// Función para actualizar Notion (sin cambios)
async function updateNotion(hours) {
    try {
        console.log('Intentando actualizar Notion...');
        console.log('Page ID:', SOLEST_PAGE_ID);
        console.log('Horas a actualizar:', hours);

        const updateResponse = await notion.pages.update({
            page_id: SOLEST_PAGE_ID,
            properties: {
                'Horas SOLEST': {
                    type: 'number',
                    number: hours
                }
            }
        });

        console.log('Notion actualizado exitosamente');
        return true;
    } catch (error) {
        console.error('Error detallado de Notion:', {
            message: error.message,
            code: error.code,
            body: error.body
        });
        throw new Error(`Error de Notion: ${error.message}`);
    }
}

// Handler para la API de Vercel (sin cambios)
module.exports = async (req, res) => {
    try {
        // Permitir CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (req.url === '/api/update') {
            console.log('Iniciando proceso de actualización...');
            const hours = await getClockifyHours();
            await updateNotion(hours);

            res.status(200).json({
                status: 'success',
                message: 'Horas actualizadas correctamente',
                hours
            });
        } else {
            res.status(200).json({
                status: 'success',
                message: 'API funcionando. Usa /api/update para actualizar las horas.'
            });
        }
    } catch (error) {
        console.error('Error en el proceso:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            details: error.response?.data || 'No hay detalles adicionales'
        });
    }
};
