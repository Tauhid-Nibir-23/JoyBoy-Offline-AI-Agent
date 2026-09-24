export interface SystemStatus {
  os: string;
  isOnline: boolean;
  dbStatus: 'Initialized' | 'Offline/Error' | 'Connecting';
  aiStatus: 'Offline/Unavailable for now' | 'Ready' | 'Busy';
  nodeVersion: string;
}

export function detectEnvironment(): SystemStatus {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'Windows';
  if (userAgent.includes('Linux')) os = 'Linux / Manjaro';
  else if (userAgent.includes('Mac')) os = 'macOS';

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;

  return {
    os,
    isOnline,
    dbStatus: 'Initialized',
    aiStatus: 'Offline/Unavailable for now',
    nodeVersion: 'v26.3.0'
  };
}
