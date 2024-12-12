import fetch from 'node-fetch'; 
import { logger } from './logger.js';
async function coday(url, method, headers, payloadData = null) {
    try {
        const options = {
            method,
            headers,
        };
        if (payloadData) {
            options.body = JSON.stringify(payloadData);
        }
        const response = await fetch(url, options);
        const jsonData = await response.json().catch(() => ({}));

        if (!response.ok) {
            return { error: true, status: response.status, data: jsonData };
        }
        return jsonData;
    } catch (error) {
        logger(`Error in coday: ${error.message}`, 'error');
        return { error: true, message: error.message };
    }
}

// Main Logic for estimating, claiming, and starting rewards
async function estimate(id, headers) {
    const url = 'https://api.meshchain.ai/meshmain/rewards/estimate';
    const result = await coday(url, 'POST', headers, { unique_id: id });
    if (result.status === 400){
      logger("Mine Not Start, Starting Mine...")
      await start(id, headers);

    }
    
    return result || undefined;
}

async function claim(id, headers) {
    const url = 'https://api.meshchain.ai/meshmain/rewards/claim';
    const result = await coday(url, 'POST', headers, { unique_id: id });

    return result.total_reward || null;
}

async function start(id, headers) {
    const url = 'https://api.meshchain.ai/meshmain/rewards/start';
    const result = await coday(url, 'POST', headers, { unique_id: id });

    return result || null;
}
async function info(id, headers) {
    const url = 'https://api.meshchain.ai/meshmain/nodes/status';
    const result = await coday(url, 'POST', headers, { unique_id: id });

    return result || null;
}

export { coday, estimate, claim, start, info };
