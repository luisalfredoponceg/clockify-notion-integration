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

        const requestBody = {
            dateRangeStart: startDate.toISOString(),
            dateRangeEnd: endDate.toISOString(),
            detailedFilter: {
                page: 1,
                pageSize: 1000,
                sortColumn: "DATE"
            },
            projects: {
                ids: [CLOCKIFY_PROJECT_ID],
                contains: "CONTAINS"
            }
        };

        console.log('Request Body:', JSON.stringify(requestBody, null, 2));

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
        console.log('Número total de entradas:', response.data.timeentries?.length || 0);

        let totalSeconds = 0;

        if (response.data.timeentries && response.data.timeentries.length > 0) {
            response.data.timeentries.forEach((entry, index) => {
                const duration = entry.timeInterval.duration;
                console.log(`Entrada ${index + 1}:`, {
                    description: entry.description,
                    duration: duration,
                    start: entry.timeInterval.start,
                    end: entry.timeInterval.end
                });

                // Sumamos los segundos directamente
                totalSeconds += duration;
            });
        }

        // Convertimos segundos a horas
        const hours = Number((totalSeconds / 3600).toFixed(2));
        
        console.log('Total segundos:', totalSeconds);
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

// Función para actualizar Notion
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

// Handler para la API de Vercel
module.exports = async (req, res) => {
    try {
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
