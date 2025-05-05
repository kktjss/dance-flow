const axios = require('axios');

async function testSaveKeyframes() {
    try {
        console.log('Testing /api/test/test-save-keyframes endpoint...');

        const projectId = '68160e6288e5f5551f050655'; // Use your actual project ID
        const elementId = 'ae866a9a-1749-43c2-bb24-ae2565cb764d'; // Use a valid element ID

        const payload = {
            projectId,
            elementId,
            keyframes: [
                {
                    time: 0,
                    position: { x: 100, y: 100 },
                    opacity: 1,
                    scale: 1
                },
                {
                    time: 5000,
                    position: { x: 200, y: 200 },
                    opacity: 0.5,
                    scale: 1.5
                }
            ]
        };

        console.log(`Sending test request with project ID ${projectId} and element ID ${elementId}`);
        console.log(`Payload includes ${payload.keyframes.length} keyframes`);

        const response = await axios.post('http://localhost:5000/api/test/test-save-keyframes', payload);

        console.log('Response status:', response.status);
        console.log('Response data:', response.data);

        console.log('Test completed successfully');
    } catch (error) {
        console.error('Error during test:');
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
            console.error(`Headers:`, error.response.headers);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from server');
            console.error(error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up request:', error.message);
        }
    }
}

testSaveKeyframes(); 