// Test script for the direct-keyframes endpoint
const axios = require('axios');

async function testDirectSave() {
    const projectId = '68160e6288e5f5551f050655'; // Use your actual project ID
    const elementId = 'ae866a9a-1749-43c2-bb24-ae2565cb764d'; // Use your actual element ID

    const testData = {
        elementId: elementId,
        keyframes: [
            {
                time: 0,
                position: { x: 100, y: 100 },
                opacity: 1,
                scale: 1
            },
            {
                time: 1,
                position: { x: 200, y: 200 },
                opacity: 0.5,
                scale: 1.5
            }
        ]
    };

    try {
        console.log('Sending test request to direct-keyframes endpoint...');
        const response = await axios.post(
            `http://localhost:5000/api/projects/${projectId}/direct-keyframes`,
            testData
        );

        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        console.log('Test successful!');
    } catch (error) {
        console.error('Error testing endpoint:');
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received');
        } else {
            // Something happened in setting up the request
            console.error('Error message:', error.message);
        }
    }
}

// Run the test
testDirectSave(); 