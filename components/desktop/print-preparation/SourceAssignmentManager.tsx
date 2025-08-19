'use client';

import { useState } from 'react';
import { BeakerIcon } from '@heroicons/react/24/solid';
import SourceContainerSelector from '../../workspace/SourceContainerSelector';

export interface SourceAssignment {
  lineItemId: string;
  productName: string;
  quantity: number;
  workflowType: 'pump_and_fill' | 'direct_resell';
  sourceContainers: Array<{
    id: string;
    name: string;
  }>;
}

interface SourceAssignmentManagerProps {
  assignments: SourceAssignment[];
  onAssignmentsChange: (assignments: SourceAssignment[]) => void;
  onGradeMismatch?: (mismatch: {
    sourceGrade: string;
    destinationGrade: string;
    sourceContainer: string;
    productName: string;
  }) => void;
}

export default function SourceAssignmentManager({
  assignments,
  onAssignmentsChange,
  onGradeMismatch
}: SourceAssignmentManagerProps) {
  const [selectingSourceFor, setSelectingSourceFor] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<'add' | 'replace'>('add');
  const [editingSourceIndex, setEditingSourceIndex] = useState<number | null>(null);
  const [duplicatingSource, setDuplicatingSource] = useState<any | null>(null);

  const handleWorkflowTypeChange = (lineItemId: string, workflowType: 'pump_and_fill' | 'direct_resell') => {
    const updatedAssignments = assignments.map(a => 
      a.lineItemId === lineItemId 
        ? { ...a, workflowType, sourceContainers: workflowType === 'direct_resell' ? [] : a.sourceContainers }
        : a
    );
    onAssignmentsChange(updatedAssignments);
  };

  const handleSourceContainerSelect = (container: any) => {
    if (!selectingSourceFor) return;
    
    const assignment = assignments.find(a => a.lineItemId === selectingSourceFor);
    if (!assignment) return;

    // Check for grade mismatch
    const sourceGrade = container.properties?.grade || '';
    const destinationGrade = assignment.productName.match(/\((.*?)\)/)?.[1] || '';
    
    if (sourceGrade && destinationGrade && sourceGrade !== destinationGrade && onGradeMismatch) {
      onGradeMismatch({
        sourceGrade,
        destinationGrade,
        sourceContainer: container.name,
        productName: assignment.productName
      });
    }

    let updatedAssignments;
    if (editingMode === 'replace' && editingSourceIndex !== null) {
      updatedAssignments = assignments.map(a => {
        if (a.lineItemId === selectingSourceFor) {
          const newContainers = [...a.sourceContainers];
          newContainers[editingSourceIndex] = {
            id: container.id,
            name: container.name
          };
          return { ...a, sourceContainers: newContainers };
        }
        return a;
      });
    } else {
      updatedAssignments = assignments.map(a => 
        a.lineItemId === selectingSourceFor 
          ? { ...a, sourceContainers: [...a.sourceContainers, { id: container.id, name: container.name }] }
          : a
      );
    }
    
    onAssignmentsChange(updatedAssignments);
    setSelectingSourceFor(null);
    setEditingMode('add');
    setEditingSourceIndex(null);
  };

  const removeSourceContainer = (lineItemId: string, index: number) => {
    const updatedAssignments = assignments.map(a => {
      if (a.lineItemId === lineItemId) {
        const newContainers = a.sourceContainers.filter((_, i) => i !== index);
        return { ...a, sourceContainers: newContainers };
      }
      return a;
    });
    onAssignmentsChange(updatedAssignments);
  };

  const duplicateSourceContainer = (lineItemId: string, sourceContainer: any) => {
    setDuplicatingSource(sourceContainer);
    setSelectingSourceFor(lineItemId);
    setEditingMode('add');
  };

  const pumpAndFillItems = assignments.filter(a => a.workflowType === 'pump_and_fill');
  const directResellItems = assignments.filter(a => a.workflowType === 'direct_resell');

  return (
    <>
      <div className="space-y-6">
        {/* Pump & Fill Items */}
        {pumpAndFillItems.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <BeakerIcon className="h-4 w-4 text-blue-500" />
              Pump & Fill Items (Require Source Containers)
            </h4>
            <div className="space-y-3">
              {pumpAndFillItems.map((assignment) => (
                <div key={assignment.lineItemId} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{assignment.productName}</p>
                      <p className="text-sm text-gray-600">Quantity: {assignment.quantity}</p>
                    </div>
                    <button
                      onClick={() => handleWorkflowTypeChange(assignment.lineItemId, 'direct_resell')}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Switch to Direct Resell
                    </button>
                  </div>
                  
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Source Containers:</p>
                    {assignment.sourceContainers.length > 0 ? (
                      <div className="space-y-2">
                        {assignment.sourceContainers.map((sc, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                            <span className="text-sm">{sc.name}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => duplicateSourceContainer(assignment.lineItemId, sc)}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                                title="Add another container of this type"
                              >
                                Duplicate
                              </button>
                              <button
                                onClick={() => {
                                  setSelectingSourceFor(assignment.lineItemId);
                                  setEditingMode('replace');
                                  setEditingSourceIndex(index);
                                }}
                                className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                              >
                                Replace
                              </button>
                              <button
                                onClick={() => removeSourceContainer(assignment.lineItemId, index)}
                                className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-orange-600 italic">No source container assigned</p>
                    )}
                    <button
                      onClick={() => {
                        setSelectingSourceFor(assignment.lineItemId);
                        setEditingMode('add');
                        setEditingSourceIndex(null);
                      }}
                      className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      {assignment.sourceContainers.length > 0 ? 'Add Another Source' : 'Assign Source Container'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct Resell Items */}
        {directResellItems.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              Direct Resell Items (Pre-packaged)
            </h4>
            <div className="space-y-3">
              {directResellItems.map((assignment) => (
                <div key={assignment.lineItemId} className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{assignment.productName}</p>
                      <p className="text-sm text-gray-600">Quantity: {assignment.quantity}</p>
                      <p className="text-xs text-green-600 mt-1">✓ Ready to ship - no source container needed</p>
                    </div>
                    <button
                      onClick={() => handleWorkflowTypeChange(assignment.lineItemId, 'pump_and_fill')}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Switch to Pump & Fill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Source Container Selector Modal */}
      {selectingSourceFor && (
        <SourceContainerSelector
          onSelect={handleSourceContainerSelect}
          onClose={() => {
            setSelectingSourceFor(null);
            setEditingMode('add');
            setEditingSourceIndex(null);
            setDuplicatingSource(null);
          }}
          preselectedContainer={duplicatingSource}
        />
      )}
    </>
  );
}