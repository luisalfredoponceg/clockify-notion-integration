const { Client } = require('@notionhq/client');
const axios = require('axios');

// Configuración de las variables de entorno
const CLOCKIFY_API_KEY = process.env.CLOCKIFY_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const SOLEST_PAGE_ID = process.env.SOLEST_PAGE_ID;
const CLOCKIFY_PROJECT_ID = process.env.CLOCKIFY_PROJECT_ID;
const WORKSPACE_ID = process.env.WORKSPACE_ID;

// Inicializar cliente de Notion
const notion = new Client({
  auth: NOTION_TOKEN
});

// Función para obtener las horas de Clockify usando la API de reportes
async function getClockifyHours() {
  try {
    console.log('Intentando conectar con Clockify para obtener horas...');
    
    const response = await axios.post(
      `https://api.clockify.me/api/v1/workspaces/${WORKSPACE_ID}/reports/summary`,
      {
        "dateRangeStart": "2024-01-01T00:00:00.000Z", // Rango de fechas para el reporte
        "dateRangeEnd": new Date().toISOString(),      // Fecha actual como fin del rango
        "projects": [CLOCKIFY_PROJECT_ID],
        "summaryFilter": {
          "groups": ["PROJECT"]
        }
      },
      {
        headers: {
          'X-Api-Key': CLOCKIFY_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    // Asumimos que el primer resultado contiene las horas totales del proyecto
    const projectSummary = response.data.totals[0];
    const hours = projectSummary?.totalTime || 0; // En formato de milisegundos

    // Convertir milisegundos a horas
    const hoursInHours = hours / 1000 / 60 / 60;
    console.log('Horas obtenidas de Clockify:', hoursInHours);
    return hoursInHours;
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
    await notion.pages.update({
      page_id: SOLEST_PAGE_ID,
      properties: {
        'Horas SOLEST': {
          number: hours
        }
      }
    });
    console.log('Notion actualizado exitosamente');
    return true;
  } catch (error) {
    console.error('Error detallado de Notion:', error);
    throw new Error(`Error de Notion: ${error.message}`);
  }
}

// Handler para la API de Vercel
module.exports = async (req, res) => {
  if (req.url === '/api/update') {
    try {
      console.log('Iniciando proceso de actualización...');
      console.log('Variables de entorno configuradas:', {
        hasClockifyKey: !!CLOCKIFY_API_KEY,
        hasNotionToken: !!NOTION_TOKEN,
        hasWorkspaceId: !!WORKSPACE_ID,
        hasProjectId: !!CLOCKIFY_PROJECT_ID,
        hasPageId: !!SOLEST_PAGE_ID
      });

      const hours = await getClockifyHours();
      console.log('Horas obtenidas:', hours);
      await updateNotion(hours);
      
      res.status(200).json({ 
        status: 'success', 
        message: 'Horas actualizadas correctamente', 
        hours 
      });
    } catch (error) {
      console.error('Error en el proceso:', error);
      res.status(500).json({ 
        status: 'error', 
        message: error.message,
        details: error.response?.data || 'No hay detalles adicionales'
      });
    }
  } else {
    res.status(200).json({ 
      status: 'success', 
      message: 'API funcionando. Usa /api/update para actualizar las horas.' 
    });
  }
};
