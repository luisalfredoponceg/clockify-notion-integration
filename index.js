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
    console.log(`URL: https://api.clockify.me/api/v1/workspaces/${WORKSPACE_ID}/projects/${CLOCKIFY_PROJECT_ID}`);
    
    const response = await axios.get(
      `https://api.clockify.me/api/v1/workspaces/${WORKSPACE_ID}/projects/${CLOCKIFY_PROJECT_ID}/reports`,
      {
        headers: {
          'X-Api-Key': CLOCKIFY_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Respuesta de Clockify:', response.data);
    return response.data.duration || 0;
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
