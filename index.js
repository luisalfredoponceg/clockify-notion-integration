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
            summaryFilter: {
                groups: ["PROJECT"]
            },
            projects: {
                ids: [CLOCKIFY_PROJECT_ID]
            }
        };

        console.log('Request Body:', JSON.stringify(requestBody, null, 2));

        const response = await axios.post(
            `https://reports.api.clockify.me/v1/workspaces/${WORKSPACE_ID}/reports/summary`,
            requestBody,
            {
                headers: {
                    'X-Api-Key': CLOCKIFY_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Respuesta completa de Clockify:', JSON.stringify(response.data, null, 2));

        let hours = 0;

        if (response.data.totals && response.data.totals[0]) {
            console.log('Totals encontrado:', response.data.totals[0]);
            hours = response.data.totals[0].totalTime / (1000 * 60 * 60);
        } else if (response.data.groupOne) {
            console.log('GroupOne encontrado:', response.data.groupOne);
            const projectData = response.data.groupOne.find(
                group => group.id === CLOCKIFY_PROJECT_ID
            );
            if (projectData) {
                hours = projectData.duration / (1000 * 60 * 60);
            }
        }

        console.log('Horas calculadas:', hours);
        return Number(hours.toFixed(2));
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
async function
