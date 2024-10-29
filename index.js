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
    
    // Obtener la fecha actual y la fecha de inicio del año
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), 0, 1); // Desde el 1 de enero del año actual

    const requestBody = {
      dateRangeStart: startDate.toISOString(),
      dateRangeEnd: endDate.toISOString(),
      detailedFilter: {
        page: 1,
        pageSize: 1000, // Aumentamos el tamaño de página para obtener todos los registros
        sortColumn: "DATE",
      },
      exportType: "JSON",
      projects: [CLOCKIFY_PROJECT_ID]
    };

    console.log('Conectando a Clockify con las siguientes fechas:');
    console.log('Fecha inicio:', startDate.toISOString());
    console.log('Fecha fin:', endDate.toISOString());
    
    // Usar el endpoint de reportes detallados
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
    
    console.log('Respuesta recibida de Clockify');
    console.log('Total de registros:', response.data.totals?.length || 0);
    
    // Calcular el total de horas
    let totalSeconds = 0;
    if (response.data.timeentries) {
      response.data.timeentries.forEach(entry => {
        console.log('Entrada:', entry.timeInterval.duration);
        // La duración viene en formato "PT1H30M" o similar
        const durationStr = entry.timeInterval.duration;
        const hours = (durationStr.match(/(\d+)H/) || [0, 0])[1];
        const minutes = (durationStr.match(/(\d+)M/) || [0, 0])[1];
        totalSeconds += (parseInt(hours) * 3600) + (parseInt(minutes) * 60);
      });
    }

    const totalHours = totalSeconds / 3600;
    console.log('Total de horas calculadas:', totalHours);
    
    return Number(totalHours.toFixed(2));

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
    
    // Actualizamos la página con las nuevas horas
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
        hours,
        info: 'Revisa los logs en Vercel para más detalles'
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
