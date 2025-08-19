'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { areGradesCompatible, formatGrade, getGradeCategory } from '@/lib/config/grade-compatibility';

interface GradeMismatchWarning {
  sourceGrade: string;
  destinationGrade: string;
  sourceContainer: string;
  productName: string;
}

interface GradeMismatchValidatorProps {
  warning: GradeMismatchWarning | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function GradeMismatchValidator({
  warning,
  onConfirm,
  onCancel
}: GradeMismatchValidatorProps) {
  if (!warning) return null;

  const isCompatible = areGradesCompatible(warning.sourceGrade, warning.destinationGrade);
  const sourceCategory = getGradeCategory(warning.sourceGrade);
  const destCategory = getGradeCategory(warning.destinationGrade);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-start gap-4">
          <ExclamationTriangleIcon 
            className={`h-8 w-8 flex-shrink-0 ${
              isCompatible ? 'text-yellow-500' : 'text-red-500'
            }`} 
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isCompatible ? 'Grade Difference Detected' : 'Grade Incompatibility Warning'}
            </h3>
            
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Source Container:</span>
                  <span className="font-medium">{warning.sourceContainer}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Source Grade:</span>
                  <span className="font-medium text-blue-600">
                    {formatGrade(warning.sourceGrade)} ({sourceCategory})
                  </span>
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Destination Product:</span>
                  <span className="font-medium">{warning.productName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Required Grade:</span>
                  <span className="font-medium text-purple-600">
                    {formatGrade(warning.destinationGrade)} ({destCategory})
                  </span>
                </div>
              </div>

              {!isCompatible && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>⚠️ Critical Warning:</strong> These grades are incompatible. 
                    Mixing {formatGrade(warning.sourceGrade)} grade material into a 
                    {' '}{formatGrade(warning.destinationGrade)} grade container may 
                    contaminate the product and violate quality standards.
                  </p>
                </div>
              )}

              {isCompatible && sourceCategory !== destCategory && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>ℹ️ Note:</strong> While these grades are technically compatible, 
                    they are from different categories. Please verify this is intentional.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel & Choose Different
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  isCompatible
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {isCompatible ? 'Proceed Anyway' : 'Override & Continue'}
              </button>
            </div>

            {!isCompatible && (
              <p className="text-xs text-gray-500 text-center mt-3">
                By clicking "Override & Continue", you acknowledge the grade incompatibility 
                and take responsibility for any quality issues.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}