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
            hours = response.data.totals[0].totalTime / (1000 * 60 * 60); // Ensure totalTime is correct
        } else if (response.data.groupOne) {
            console.log('GroupOne encontrado:', response.data.groupOne);
            const projectData = response.data.groupOne.find(
                group => group.id === CLOCKIFY_PROJECT_ID
            );
            if (projectData) {
                hours = projectData.duration / (1000 * 60 * 60); // Ensure duration is correct
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
