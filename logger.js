import chalk from 'chalk';
// Helper Function: Logger
export function logger(message, level = 'info') {
    const now = new Date().toISOString();
    const colors = {
        info: chalk.blue,
        warn: chalk.yellow,
        error: chalk.red,
        success: chalk.green,
        debug: chalk.magenta,
    };
    const color = colors[level] || chalk.white;
    console.log(color(`[${now}] [${level.toUpperCase()}]: ${message}`));
}
