'use client';

import { useState, useRef } from 'react';
import { MicrophoneIcon, CameraIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { reportIssue } from '@/app/actions/ai';

interface AIIssueReporterProps {
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AIIssueReporter({ 
  orderId, 
  onClose, 
  onSuccess 
}: AIIssueReporterProps) {
  const { toast } = useToast()
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
    } catch (_error) {
      toast({
        title: "Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      })
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
    if (!audioBlob && !imageFile && !context) {
      toast({
        title: "Error",
        description: "Please provide audio, image, or description",
        variant: "destructive"
      })
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert image to base64 if present
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      
      if (imageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
          };
        });
        reader.readAsDataURL(imageFile);
        imageBase64 = await base64Promise;
        mimeType = imageFile.type;
      }

      // Call server action
      const result = await reportIssue({
        issueType: 'warehouse_issue',
        description: context || 'Issue reported via AI reporter',
        severity: 'medium',
        imageBase64,
        mimeType,
        workspaceId: orderId
      });

      if (result.success) {
        toast({
          title: "Success",
          description: "Issue reported successfully! ID: " + result.issueId
        })
        onSuccess();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive"
      })
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">Report Issue with AI</h2>          <Button
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
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "stop" : "info"}
                size="large"
                haptic={isRecording ? "error" : "light"}
                icon={<MicrophoneIcon className="h-6 w-6" />}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>
              
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
          <Button
            onClick={submitReport}
            disabled={isSubmitting || (!audioBlob && !imageFile)}
            variant="info"
            size="xlarge"
            fullWidth
            loading={isSubmitting}
            haptic="success"
          >
            {isSubmitting ? 'Analyzing with AI...' : 'Submit Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}
