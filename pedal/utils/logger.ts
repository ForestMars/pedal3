/**
 * Logger utility for PEDAL operators
 * Provides consistent logging with timestamps and task context
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/storage.config';

/**
 * Log level type
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Creates a logger for the specified task
 * @param taskId - Identifier for the task (usually from TASK_ID env var)
 * @returns Logger object with methods for different log levels
 */
export function createLogger(taskId: string = process.env.TASK_ID || 'unknown') {
  // Ensure log directory exists
  const logDir = config.logsDir;
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFilePath = path.join(logDir, `${taskId}.log`);

  /**
   * Writes a log entry to the task's log file
   * @param level - Log level
   * @param message - Message to log
   * @param data - Optional data to include in log
   */
  const log = (level: LogLevel, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    let logEntry = `${timestamp} - ${level.toUpperCase()} - ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        try {
          logEntry += ` - ${JSON.stringify(data)}`;
        } catch (e) {
          logEntry += ` - [Non-serializable object]`;
        }
      } else {
        logEntry += ` - ${data}`;
      }
    }
    
    logEntry += '\n';
    
    try {
      fs.appendFileSync(logFilePath, logEntry);
    } catch (error) {
      console.error(`Failed to write to log file: ${error}`);
      console.log(logEntry); // Fallback to console
    }
    
    // Also output to stdout for Airflow to capture
    console.log(logEntry.trim());
  };

  return {
    info: (message: string, data?: any) => log('info', message, data),
    warn: (message: string, data?: any) => log('warn', message, data),
    error: (message: string, data?: any) => log('error', message, data),
    debug: (message: string, data?: any) => log('debug', message, data),
  };
}
