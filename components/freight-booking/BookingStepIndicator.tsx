'use client';

import { 
  ClockIcon,
  DocumentCheckIcon,
  BeakerIcon,
  TruckIcon,
  ArrowRightIcon
} from '@heroicons/react/24/solid';
import type { BookingStep } from '@/types/freight-booking';

interface BookingStepIndicatorProps {
  currentStep: BookingStep;
}

const steps = [
  { key: 'selection' as BookingStep, label: 'Select', icon: ClockIcon },
  { key: 'classification' as BookingStep, label: 'Classify', icon: DocumentCheckIcon },
  { key: 'hazmat-analysis' as BookingStep, label: 'Hazmat', icon: BeakerIcon },
  { key: 'confirmation' as BookingStep, label: 'Confirm', icon: TruckIcon }
];

export default function BookingStepIndicator({ currentStep }: BookingStepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);
  
  return (
    <div className="hidden md:flex items-center space-x-4">
      {steps.map((step, index) => {
        const isActive = currentStep === step.key;
        const isCompleted = currentIndex > index;
        const StepIcon = step.icon;
        
        return (
          <div key={step.key} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              isActive ? 'border-blue-600 bg-blue-600 text-white' :
              isCompleted ? 'border-green-600 bg-green-600 text-white' :
              'border-gray-300 bg-white text-gray-400'
            }`}>
              <StepIcon className="h-5 w-5" />
            </div>
            <span className={`ml-2 text-sm font-medium ${
              isActive ? 'text-blue-600' :
              isCompleted ? 'text-green-600' :
              'text-gray-400'
            }`}>
              {step.label}
            </span>
            {index < 3 && (
              <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-4" />
            )}
          </div>
        );
      })}
    </div>
  );
}