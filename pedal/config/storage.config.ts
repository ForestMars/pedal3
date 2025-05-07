/**
 * Storage configuration for PEDAL
 * Configures paths for artifacts, distribution and logs
 * Can be overridden with environment variables
 */
export const config = {
  /**
   * Directory for storing pipeline artifacts
   */
  artifactsDir: process.env.ARTIFACTS_DIR || '/pedal/artifacts',
  
  /**
   * Directory for final distribution packages
   */
  distDir: process.env.DIST_DIR || '/pedal/dist',
  
  /**
   * Directory for operator logs
   */
  logsDir: process.env.LOGS_DIR || '/pedal/logs',
  
  /**
   * Optional remote storage configuration (e.g., S3)
   * If not provided, local filesystem is used
   */
  remoteStorage: process.env.REMOTE_STORAGE === 'true' ? {
    provider: process.env.STORAGE_PROVIDER || 's3',
    bucket: process.env.STORAGE_BUCKET || 'pedal-artifacts',
    region: process.env.STORAGE_REGION || 'us-east-1',
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
  } : undefined,

  /**
   * Supabase configuration
   */
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  }
};
