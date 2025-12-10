export enum AppStep {
  UPLOAD = 'UPLOAD',
  TRANSCRIPT = 'TRANSCRIPT',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}

export interface ProcessingState {
  step: AppStep;
  videoFile: File | null;
  videoBase64: string | null;
  transcript: string;
  generatedSrt: string;
  error: string | null;
}

export interface VideoMetadata {
  name: string;
  size: number;
  type: string;
}