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

// Función para obtener las horas de Clockify
async function getClockifyHours() {
  try {
    console.log('Intentando conectar con Clockify...');
    
    // Obtener la fecha actual y la fecha de hace un mes
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const requestBody = {
      dateRangeStart: startDate.toISOString(),
      dateRangeEnd: endDate.toISOString(),
      summaryFilter: {
        groups: ["PROJECT"]
      }
    };

    // Usar el endpoint correcto para reportes detallados
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
    
    console.log('Respuesta de Clockify:', response.data);

    // Buscar el proyecto específico y extraer las horas
    const projectData = response.data.groupOne.find(
      group => group.id === CLOCKIFY_PROJECT_ID
    );

    if (!projectData) {
      console.log('No se encontraron datos para el proyecto especificado');
      return 0;
    }

    // Convertir la duración de milisegundos a horas
    const hours = projectData.duration / (1000 * 60 * 60);
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
async function updateNotion(hours) {
  try {
    console.log('Intentando actualizar Notion...');
    
    // Primero, verificamos si la página existe y obtenemos su información
    const page = await notion.pages.retrieve({ page_id: SOLEST_PAGE_ID });
    console.log('Página de Notion encontrada:', page);

    // Actualizamos la página con las nuevas horas
    await notion.pages.update({
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
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
