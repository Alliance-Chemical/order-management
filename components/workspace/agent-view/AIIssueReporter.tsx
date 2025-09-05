'use client';

import { useState, useRef } from 'react';
import { MicrophoneIcon, CameraIcon, XMarkIcon } from '@heroicons/react/24/solid';
import WarehouseButton from '@/components/ui/WarehouseButton';
import ProgressBar from '@/components/ui/ProgressBar';

interface AIIssueReporterProps {
  orderId: string;
  workerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AIIssueReporter({ 
  orderId, 
  workerId, 
  onClose, 
  onSuccess 
}: AIIssueReporterProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [context, setContext] = useState('');
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitReport = async () => {
    if (!audioBlob && !imageFile) {
      alert('Please record audio or capture an image');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('orderId', orderId);
      formData.append('workerId', workerId);
      formData.append('context', context);
      
      if (audioBlob) {
        formData.append('audio', audioBlob, 'recording.webm');
      }
      
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await fetch('/api/ai/issue-report', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        alert(
          result.escalated 
            ? 'Issue reported and escalated to supervisor!' 
            : 'Issue reported successfully!'
        );
        onSuccess();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Failed to submit report. Please try again.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">Report Issue with AI</h2>          <WarehouseButton
            onClick={onClose}
            variant="neutral"
            size="base"
            icon={<XMarkIcon className="h-6 w-6" />}
          />
        </div>

        <div className="p-6 space-y-6">
          {/* Voice Recording Section */}
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Voice Description</h3>
            <div className="flex items-center space-x-4">
              <WarehouseButton
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "stop" : "info"}
                size="large"
                haptic={isRecording ? "error" : "light"}
                icon={<MicrophoneIcon className="h-6 w-6" />}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </WarehouseButton>
              
              {audioBlob && !isRecording && (
                <span className="text-green-600 font-medium">
                  ✓ Audio recorded
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Describe the issue verbally - AI will transcribe and analyze
            </p>
          </div>

          {/* Image Capture Section */}
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Visual Evidence</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />
            
            {imagePreview ? (
              <div className="space-y-3">
                <img 
                  src={imagePreview} 
                  alt="Issue" 
                  className="w-full max-h-64 object-contain rounded-lg"
                />
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview('');
                  }}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Remove Image
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold"
              >
                <CameraIcon className="h-6 w-6" />
                <span>Capture Photo</span>
              </button>
            )}
            <p className="text-sm text-gray-600 mt-2">
              Take a photo of the issue - AI will analyze for damage or defects
            </p>
          </div>

          {/* Context Input */}
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Additional Context (Optional)</h3>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Any additional details..."
              className="w-full p-3 border rounded-lg resize-none"
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <WarehouseButton
            onClick={submitReport}
            disabled={isSubmitting || (!audioBlob && !imageFile)}
            variant="info"
            size="xlarge"
            fullWidth
            loading={isSubmitting}
            haptic="success"
          >
            {isSubmitting ? 'Analyzing with AI...' : 'Submit Report'}
          </WarehouseButton>
        </div>
      </div>
    </div>
  );
}