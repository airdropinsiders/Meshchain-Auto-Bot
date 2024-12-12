import { coday, start } from './scripts.js';
import readline from 'readline/promises'; 
import fs from 'fs/promises'; 
import crypto from 'crypto';
import { logger } from './logger.js';
import { banner } from './banner.js';
import { solveAntiCaptcha, solve2Captcha } from './utils/solver.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

let headers = {
    'Content-Type': 'application/json',
};

// Register Function
async function register(name, email, password, apiKey) {
    const payloadReg = {
        captcha_token: await solveAntiCaptcha(apiKey),
        full_name: name,
        email: email,
        password: password,
        referral_code: "3NR2VSUE3KKM",
    };
    const response = await coday(
        'https://api.meshchain.ai/meshmain/auth/email-signup',
        'POST',
        headers,
        payloadReg
    );
    return response.message || "No message returned";
}

// Login Function
async function login(email, password, apiKey) {
    const payloadLogin = {
        captcha_token: await solveAntiCaptcha(apiKey),
        email: email,
        password: password,
    };
    const response = await coday(
        'https://api.meshchain.ai/meshmain/auth/email-signin',
        'POST',
        headers,
        payloadLogin
    );

    if (response.access_token) {
        logger('Login successful!', "success");
        return response;
    }
    logger('Login failed. Check your credentials.', "error");
    return null;
}

// Verify Email Function
async function verify(email, otp, apiKey) {
    const payloadVerify = {
        captcha_token: await solveAntiCaptcha(apiKey),
        email: email,
        code: otp,
    };
    const response = await coday(
        'https://api.meshchain.ai/meshmain/auth/verify-email',
        'POST',
        headers,
        payloadVerify
    );
    return response.message || "Verify failed";
}

// Claim BNB Reward Function
async function claimBnb() {
    const payloadClaim = { mission_id: "EMAIL_VERIFICATION" };
    const response = await coday(
        'https://api.meshchain.ai/meshmain/mission/claim',
        'POST',
        headers,
        payloadClaim
    );
    return response.status || "Claim failed";
}

// Generate a 16-byte hexadecimal string
function generateHex() {
    return crypto.randomBytes(16).toString('hex');
}

// Initialize Node and Save Unique ID
async function init(randomHex) {
    const url = "https://api.meshchain.ai/meshmain/nodes/link";
    const payload = { "unique_id": randomHex, "node_type": "browser", "name": "Extension" };

    const response = await coday(url, 'POST', headers, payload);
    if (response.id) {
        try {
            // Append the unique ID to unique_id.txt
            await fs.appendFile('unique_id.txt', `${response.unique_id}\n`, 'utf-8');
            logger(`ID saved to unique_id.txt: ${response.unique_id}`, "success");
        } catch (err) {
            logger('Failed to save unique ID to file:', "error", err.message);
        }
    }
    return response;
}

// Main Function
async function main() {
    try {
        logger(banner, "debug");

        // Prompt user for input sequentially
        const apiKey = await rl.question("Enter ApiKey from Anti-Captcha: ");
        const name = await rl.question("Enter your name: ");
        const email = await rl.question("Enter your email: ");
        const password = await rl.question("Enter your password: ");

        // Register the user
        const registerMessage = await register(name, email, password, apiKey);
        logger(`Register response: ${registerMessage}`);

        // Log in the user
        const loginData = await login(email, password, apiKey);
        if (!loginData) return;

        // Set headers with access token
        headers = {
            ...headers,
            'Authorization': `Bearer ${loginData.access_token}`,
        };

        // Verify Email
        const otp = await rl.question("Enter OTP from Email: ");
        const verifyMessage = await verify(email, otp, apiKey);
        logger(`Verify response: ${verifyMessage}`);

        // Claim Reward
        const claimMessage = await claimBnb();
        logger(`Claim 0.01 BNB Success: ${claimMessage}`, "success");

        // Create and link a unique ID
        const randomHex = generateHex();
        const linkResponse = await init(randomHex);

        // Save tokens and unique ID
        try {
            // Append tokens to token.txt
            await fs.appendFile(
                'token.txt',
                `${loginData.access_token}|${loginData.refresh_token}\n`,
                'utf-8'
            );
            logger('Tokens saved to token.txt', "success");

            // Start the node
            const starting = await start(linkResponse.unique_id, headers);
            if (starting) {
                logger(`Extension ID: ${linkResponse.unique_id} is active`, "success");
            }
        } catch (err) {
            logger('Failed to save data to files:', "error", err.message);
        }
    } catch (error) {
        logger("An error occurred:", "error", error.message);
    } finally {
        rl.close();
    }
}

main();
