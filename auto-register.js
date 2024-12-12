import { coday, start } from './scripts.js';
import readline from 'readline/promises';
import fs from 'fs/promises';
import crypto from 'crypto';
import { logger } from './logger.js';
import { banner } from './banner.js';
import Mailjs from '@cemalgnlts/mailjs';
import { solveAntiCaptcha, solve2Captcha } from './utils/solver.js';

const mailjs = new Mailjs();
const headers = { 'Content-Type': 'application/json' };

// Helper: Generate a 16-byte hexadecimal string
function generateHex() {
    return crypto.randomBytes(16).toString('hex');
}

// Helper: Save data to a file
async function saveToFile(filename, data) {
    try {
        await fs.appendFile(filename, `${data}\n`, 'utf-8');
        logger(`Data saved to ${filename}`, 'success');
    } catch (error) {
        logger(`Failed to save data to ${filename}: ${error.message}`, 'error');
    }
}

// Captcha Solver
async function captchaSolver(type, apiKey) {
    return type === '2captcha' || type === '1'
        ? solve2Captcha(apiKey)
        : solveAntiCaptcha(apiKey);
}

// Wait for OTP Email
async function waitForEmail(mailjs, retries = 10, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        const messages = await mailjs.getMessages();
        if (messages.data.length > 0) {
            const message = messages.data[0];
            const fullMessage = await mailjs.getMessage(message.id);
            const match = fullMessage.data.text.match(/Your verification code is:\s*(\d+)/);
            if (match) return match[1];
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error('Verification email not received.');
}

// Registration Function
async function register(typeKey, apiKey, name, email, password, referralCode) {
    try {
        const payload = {
            captcha_token: await captchaSolver(typeKey, apiKey),
            full_name: name,
            email,
            password,
            referral_code: referralCode,
        };
        const response = await coday('https://api.meshchain.ai/meshmain/auth/email-signup', 'POST', headers, payload);
        if (!response || response.error) throw new Error(response.error || 'Unknown registration error.');
        return response.message || 'No message returned.';
    } catch (error) {
        logger(`Register failed: ${error.message}`, 'error');
        throw error;
    }
}

// Login Function
async function login(typeKey, apiKey, email, password) {
    try {
        const payload = {
            captcha_token: await captchaSolver(typeKey, apiKey),
            email,
            password,
        };
        const response = await coday('https://api.meshchain.ai/meshmain/auth/email-signin', 'POST', headers, payload);
        if (response.access_token) {
            logger('Login successful!', 'success');
            return response;
        }
        throw new Error('Login failed. Check your credentials.');
    } catch (error) {
        logger(`Login error: ${error.message}`, 'error');
        throw error;
    }
}

// Verify Email Function
async function verify(typeKey, apiKey, email, otp) {
    try {
        const payload = {
            captcha_token: await captchaSolver(typeKey, apiKey),
            email,
            code: otp,
        };
        const response = await coday('https://api.meshchain.ai/meshmain/auth/verify-email', 'POST', headers, payload);
        if (!response || response.error) throw new Error(response.error || 'Verification failed.');
        return response.message || 'Verification succeeded.';
    } catch (error) {
        logger(`Email verification error: ${error.message}`, 'error');
        throw error;
    }
}

// Claim BNB Reward
async function claimBnb(headers) {
    try {
        const payload = { mission_id: 'EMAIL_VERIFICATION' };
        const response = await coday('https://api.meshchain.ai/meshmain/mission/claim', 'POST', headers, payload);
        logger(`Claim response: ${JSON.stringify(response)}`, 'debug');
        return response.status;
    } catch (error) {
        logger(`Claim error: ${error.message}`, 'error');
        throw error;
    }
}

// Link Node Function
async function initNode(randomHex, headers) {
    try {
        const payload = { unique_id: randomHex, node_type: 'browser', name: 'Extension' };
        const response = await coday('https://api.meshchain.ai/meshmain/nodes/link', 'POST', headers, payload);
        if (!response.id) throw new Error('Failed to link node.');
        await saveToFile('unique_id.txt', response.unique_id);
        return response;
    } catch (error) {
        logger(`Node initialization error: ${error.message}`, 'error');
        throw error;
    }
}

// Main Function: Manage Mail and Registration
async function manageMailAndRegister() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    try {
        logger(banner, 'debug');
        const typeKey = await rl.question('Choose Captcha API (1: 2Captcha, 2: Anti-Captcha): ');
        const apiKey = await rl.question('Enter Captcha API Key: ');
        if (!apiKey) throw new Error('Invalid API key.');

        const input = await rl.question('How many accounts to create? ');
        const accountCount = parseInt(input, 10);
        if (isNaN(accountCount) || accountCount <= 0) throw new Error('Invalid account count.');

        const ref = await rl.question('Use my referral code? (y/N): ');
        const referralCode = ref.toLowerCase() === 'n'
            ? await rl.question('Enter referral code: ')
            : '3NR2VSUE3KKM';

        logger(`Referral code: ${referralCode}`, 'info');

        for (let i = 0; i < accountCount; i++) {
            try {
                const account = await mailjs.createOneAccount();
                const email = account.data.username;
                const password = account.data.password;
                const name = email;

                logger(`Creating account #${i + 1} - Email: ${email}`, 'debug');
                await mailjs.login(email, password);
                logger('Logged into temporary email.');

                await register(typeKey, apiKey, name, email, password, referralCode);

                const otp = await waitForEmail(mailjs);
                logger(`OTP retrieved: ${otp}`, 'success');

                const loginData = await login(typeKey, apiKey, email, password);
                const accountHeaders = { ...headers, Authorization: `Bearer ${loginData.access_token}` };

                await verify(typeKey, apiKey, email, otp);
                await claimBnb(accountHeaders);

                const randomHex = generateHex();
                logger(`Initializing node with ID: ${randomHex}`, 'info');
                await initNode(randomHex, accountHeaders);

                await saveToFile('accounts.txt', `Email: ${email}, Password: ${password}`);
                await saveToFile('token.txt', `${loginData.access_token}|${loginData.refresh_token}`);
                logger(`Account #${i + 1} created successfully.`, 'success');
            } catch (error) {
                logger(`Error with account #${i + 1}: ${error.message}`, 'error');
            }
        }
    } catch (error) {
        logger(`Error: ${error.message}`, 'error');
    } finally {
        rl.close();
    }
}

manageMailAndRegister();
