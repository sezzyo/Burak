import React, { useState, useRef, useEffect } from 'react';
import { AppStep, ProcessingState } from './types';
import { fileToBase64, formatFileSize, downloadSrt } from './services/fileUtils';
import { generateSrtFromVideo } from './services/geminiService';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Download, RefreshCw, Film } from './components/Icons';

// Increased limit to support larger files like the user's 62MB file.
// Note: Very large files might still hit API transport limits depending on the environment.
const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>({
    step: AppStep.UPLOAD,
    videoFile: null,
    videoBase64: null,
    transcript: '',
    generatedSrt: '',
    error: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setState(prev => ({ ...prev, error: `File too large. Please upload a video smaller than ${MAX_FILE_SIZE_MB}MB.` }));
        return;
      }

      if (!file.type.startsWith('video/')) {
         setState(prev => ({ ...prev, error: "Please upload a valid video file." }));
         return;
      }

      try {
        setState(prev => ({ ...prev, videoFile: file, error: null }));
        // Pre-convert to base64 to be ready
        const base64 = await fileToBase64(file);
        setState(prev => ({ ...prev, videoBase64: base64, step: AppStep.TRANSCRIPT }));
      } catch (err) {
        setState(prev => ({ ...prev, error: "Failed to process video file." }));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        // Reuse the logic, though for a real app we'd abstract this function.
        // Duplicating briefly for the specific event type differences.
        const file = e.dataTransfer.files[0];
         if (file.size > MAX_FILE_SIZE_BYTES) {
            setState(prev => ({ ...prev, error: `File too large. Please upload a video smaller than ${MAX_FILE_SIZE_MB}MB.` }));
            return;
        }
        if (!file.type.startsWith('video/')) {
            setState(prev => ({ ...prev, error: "Please upload a valid video file." }));
            return;
         }

        try {
            setState(prev => ({ ...prev, videoFile: file, error: null }));
            const base64 = await fileToBase64(file);
            setState(prev => ({ ...prev, videoBase64: base64, step: AppStep.TRANSCRIPT }));
        } catch (err) {
            setState(prev => ({ ...prev, error: "Failed to process video file." }));
        }
    }
  };

  const handleGenerate = async () => {
    if (!state.videoBase64 || !state.videoFile || !state.transcript.trim()) {
      setState(prev => ({ ...prev, error: "Please provide both a video and a transcript." }));
      return;
    }

    setState(prev => ({ ...prev, step: AppStep.PROCESSING, error: null }));

    try {
      const srt = await generateSrtFromVideo(
        state.videoBase64,
        state.videoFile.type,
        state.transcript
      );
      setState(prev => ({ ...prev, generatedSrt: srt, step: AppStep.RESULT }));
    } catch (err: any) {
      // Provide a specific hint if the error might be size-related
      let errorMessage = err.message || "An error occurred while communicating with AI.";
      if (state.videoFile && state.videoFile.size > 20 * 1024 * 1024 && errorMessage.includes("400")) {
          errorMessage += " (The file might be too large for direct API processing. Try compressing it under 20MB.)";
      }

      setState(prev => ({ 
        ...prev, 
        step: AppStep.ERROR, 
        error: errorMessage 
      }));
    }
  };

  const handleReset = () => {
    setState({
      step: AppStep.UPLOAD,
      videoFile: null,
      videoBase64: null,
      transcript: '',
      generatedSrt: '',
      error: null,
    });
  };

  // Render Steps
  const renderUploadStep = () => (
    <div 
      className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-blue-500 transition-colors cursor-pointer bg-slate-800/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept="video/*"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
          <UploadCloud className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white">Upload your video</h3>
          <p className="text-slate-400 mt-2">Drag & drop or click to browse</p>
          <p className="text-slate-500 text-sm mt-4">Max size: {MAX_FILE_SIZE_MB}MB</p>
        </div>
      </div>
    </div>
  );

  const renderTranscriptStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3">
            <Film className="text-blue-400 w-5 h-5" />
            <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200">{state.videoFile?.name}</span>
                <span className="text-xs text-slate-500">{formatFileSize(state.videoFile?.size || 0)}</span>
            </div>
        </div>
        <button 
            onClick={handleReset}
            className="text-xs text-red-400 hover:text-red-300 underline"
        >
            Remove
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">
          Paste your Transcript / Script
        </label>
        <textarea 
          className="w-full h-64 bg-slate-800 border border-slate-700 rounded-lg p-4 text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none font-mono text-sm leading-relaxed"
          placeholder="Paste the full text of the video here..."
          value={state.transcript}
          onChange={(e) => setState(prev => ({ ...prev, transcript: e.target.value }))}
        />
        <p className="text-xs text-slate-500">
            The AI will use this text to listen to the video and generate precise timestamps.
        </p>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!state.transcript.trim()}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
          !state.transcript.trim() 
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
        }`}
      >
        Generate Subtitles
      </button>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-pulse" />
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-semibold text-white">Analyzing Video Audio...</h3>
        <p className="text-slate-400 mt-2 max-w-md mx-auto">
          Gemini 2.5 is listening to the audio and synchronizing your text. This might take a minute depending on video length.
        </p>
      </div>
    </div>
  );

  const renderResultStep = () => (
    <div className="space-y-6">
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle className="text-green-500 w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-green-400">Synchronization Complete!</h3>
          <p className="text-sm text-green-500/80">Your SRT file is ready for download.</p>
        </div>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-slate-300 mb-2">Preview SRT</label>
        <div className="relative">
            <textarea 
            readOnly
            value={state.generatedSrt}
            className="w-full h-64 bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-green-400 font-mono text-sm leading-relaxed resize-none"
            />
            <div className="absolute top-2 right-2 bg-slate-800 rounded px-2 py-1 text-xs text-slate-500 border border-slate-700">
                Read-only
            </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => downloadSrt(state.generatedSrt, state.videoFile?.name || 'video')}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-3 px-4 rounded-lg font-medium transition-all shadow-lg shadow-green-900/20"
        >
          <Download className="w-5 h-5" />
          Download .SRT
        </button>
        <button
          onClick={handleReset}
          className="flex-none px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
        >
          New Project
        </button>
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-white">Something went wrong</h3>
        <p className="text-red-400 mt-2 max-w-md mx-auto">{state.error}</p>
      </div>
      <button
        onClick={() => setState(prev => ({ ...prev, step: AppStep.TRANSCRIPT, error: null }))}
        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center p-4 sm:p-8">
      {/* Header */}
      <header className="w-full max-w-2xl mb-12 text-center">
        <div className="inline-flex items-center gap-2 mb-4 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Powered by Gemini 2.5</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
          Auto<span className="text-blue-500">Sub</span> Sync
        </h1>
        <p className="text-slate-400 text-lg">
          Upload a video + transcript. Get a perfectly timed SRT file instantly.
        </p>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {state.error && state.step !== AppStep.ERROR && (
           <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
             <AlertCircle className="text-red-500 w-5 h-5 flex-shrink-0 mt-0.5" />
             <p className="text-sm text-red-400">{state.error}</p>
           </div>
        )}

        {state.step === AppStep.UPLOAD && renderUploadStep()}
        {state.step === AppStep.TRANSCRIPT && renderTranscriptStep()}
        {state.step === AppStep.PROCESSING && renderProcessingStep()}
        {state.step === AppStep.RESULT && renderResultStep()}
        {state.step === AppStep.ERROR && renderErrorStep()}
      </main>

      {/* Footer */}
      <footer className="mt-12 text-slate-600 text-sm">
        <p>Works best with short clips (under {MAX_FILE_SIZE_MB}MB) due to browser limits.</p>
      </footer>
    </div>
  );
};

export default App;