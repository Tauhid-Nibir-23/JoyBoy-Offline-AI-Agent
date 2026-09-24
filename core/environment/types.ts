export interface HardwareProfile {
  os: string;
  architecture: string;
  cpu: string;
  logicalCores: number;
  physicalCores: number | null;
  totalRamBytes: number;
  availableRamBytes: number | null;
  gpu: string;
  gpuVendor: string | null;
  vramBytes: number | null;
}

export interface HardwareAdapter {
  detect(): Promise<HardwareProfile>;
}
