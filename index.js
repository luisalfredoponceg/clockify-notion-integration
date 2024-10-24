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
    const response = await axios.get(
      `https://api.clockify.me/api/v1/workspaces/${WORKSPACE_ID}/projects/${CLOCKIFY_PROJECT_ID}`,
      {
        headers: {
          'X-Api-Key': CLOCKIFY_API_KEY
        }
      }
    );
    
    // Obtener la duración del proyecto
    const duration = response.data.duration || 0;
    // Convertir la duración a horas (asumiendo que viene en segundos)
    const durationInHours = Math.round(duration / 3600);
    return durationInHours;
  } catch (error) {
    console.error('Error al obtener horas de Clockify:', error);
    throw error;
  }
}

// Función para actualizar Notion
async function updateNotion(hours) {
  try {
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
    console.error('Error al actualizar Notion:', error);
    throw error;
  }
}

// Handler para la API de Vercel
module.exports = async (req, res) => {
  // Verificar que la ruta sea /api/update
  if (req.url === '/api/update') {
    try {
      console.log('Iniciando actualización...');
      const hours = await getClockifyHours();
      console.log('Horas obtenidas:', hours);
      await updateNotion(hours);
      res.status(200).json({ status: 'success', message: 'Horas actualizadas correctamente', hours });
    } catch (error) {
      console.error('Error en la actualización:', error);
      res.status(500).json({ 
        status: 'error', 
        message: error.message || 'Error interno del servidor'
      });
    }
  } else {
    // Página de inicio simple
    res.status(200).json({ 
      status: 'success', 
      message: 'API funcionando. Usa /api/update para actualizar las horas.' 
    });
  }
};
