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

// Función auxiliar para convertir duración a milisegundos
function parseDuration(duration) {
    console.log('Procesando duración:', duration);
    
    if (typeof duration !== 'string') {
        console.log('La duración no es un string:', typeof duration, duration);
        return 0;
    }

    // Si la duración viene en formato de milisegundos directo
    if (!isNaN(duration)) {
        return parseInt(duration);
    }

    try {
        // Asumiendo que la duración viene en formato ISO 8601
        const hours = duration.match(/(\d+)H/)?.[1] || 0;
        const minutes = duration.match(/(\d+)M/)?.[1] || 0;
        const seconds = duration.match(/(\d+)S/)?.[1] || 0;

        console.log('Duración desglosada:', { hours, minutes, seconds });
        
        return (parseInt(hours) * 3600000) + 
               (parseInt(minutes) * 60000) + 
               (parseInt(seconds) * 1000);
    } catch (error) {
        console.error('Error al procesar la duración:', error);
        return 0;
    }
}

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

        console.log('Estructura de la respuesta:', Object.keys(response.data));
        console.log('Número total de entradas:', response.data.timeentries?.length || 0);

        // Mostrar las primeras entradas para debug
        if (response.data.timeentries && response.data.timeentries.length > 0) {
            console.log('Ejemplo de primera entrada:', JSON.stringify(response.data.timeentries[0], null, 2));
        }

        let totalMilliseconds = 0;

        if (response.data.timeentries && response.data.timeentries.length > 0) {
            response.data.timeentries.forEach((entry, index) => {
                console.log(`Procesando entrada ${index + 1}:`, {
                    description: entry.description,
                    timeInterval: entry.timeInterval
                });

                let entryDuration;
                if (entry.timeInterval && entry.timeInterval.duration) {
                    entryDuration = parseDuration(entry.timeInterval.duration);
                } else if (entry.timeInterval) {
                    // Calcular duración basada en start y end si están disponibles
                    const start = new Date(entry.timeInterval.start);
                    const end = new Date(entry.timeInterval.end);
                    entryDuration = end - start;
                }

                console.log(`Duración calculada para entrada ${index + 1}:`, entryDuration);
                totalMilliseconds += entryDuration;
            });
        }

        const hours = Number((totalMilliseconds / (1000 * 60 * 60)).toFixed(2));
        console.log('Total millisegundos:', totalMilliseconds);
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
