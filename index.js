// index.js
const { Client } = require('@notionhq/client');
const axios = require('axios');

// Configuración de las variables de entorno
const CLOCKIFY_API_KEY = 'ODc5MjJjYzUtOTJlYi00ODVmLWEzOWItYTc4Y2U0ZjNlZDI0';
const NOTION_TOKEN = 'ntn_p855786970129OnZLrNB1KRbfTTuAW9t8zJqog6rgoj6sj';
const SOLEST_PAGE_ID = '1271fe16ba8580dcb0f6e3de84224ac3';
const CLOCKIFY_PROJECT_ID = '67135e708a4e0e6c161a9fe7';
const WORKSPACE_ID = '647e9d848faddf3d230a5332';

// Inicializar cliente de Notion
const notion = new Client({
  auth: NOTION_TOKEN
});

// Función para obtener las horas de Clockify
async function getClockifyHours() {
  try {
    const response = await axios.get(
      `https://api.clockify.me/api/v1/workspaces/${WORKSPACE_ID}/projects/${CLOCKIFY_PROJECT_ID}/duration`,
      {
        headers: {
          'X-Api-Key': CLOCKIFY_API_KEY
        }
      }
    );
    
    // Convertir la duración de segundos a horas
    const durationInHours = Math.round(response.data.duration / 3600);
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
  } catch (error) {
    console.error('Error al actualizar Notion:', error);
    throw error;
  }
}

// Función principal que se ejecutará periódicamente
async function updateHours() {
  try {
    const hours = await getClockifyHours();
    await updateNotion(hours);
    return { status: 'success', message: 'Horas actualizadas correctamente' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

// Exportar la función para uso en API routes de Vercel
module.exports = async (req, res) => {
  const result = await updateHours();
  res.status(result.status === 'success' ? 200 : 500).json(result);
};
