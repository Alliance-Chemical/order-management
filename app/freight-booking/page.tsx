'use client';

import { 
  TruckIcon, 
  ClockIcon,
  DocumentCheckIcon,
  BeakerIcon
} from '@heroicons/react/24/solid';
import FreightNavigation from '@/components/navigation/FreightNavigation';
import { useFreightBooking } from '@/hooks/useFreightBooking';
import OrderSelectionStep from '@/components/freight-booking/steps/OrderSelectionStep';
import ClassificationStep from '@/components/freight-booking/steps/ClassificationStep';
import HazmatAnalysisStep from '@/components/freight-booking/steps/HazmatAnalysisStep';
import ConfirmationStep from '@/components/freight-booking/steps/ConfirmationStep';
import BookingStepIndicator from '@/components/freight-booking/BookingStepIndicator';
import BookingSuccess from '@/components/freight-booking/BookingSuccess';

export default function FreightBookingPage() {
  const {
    // State
    currentStep,
    setCurrentStep,
    bookingData,
    setBookingData,
    availableOrders,
    loading,
    booking,
    success,
    workspaceLink,
    palletData,
    
    // Per-SKU state
    hazmatBySku,
    hazErrorsBySku,
    nmfcBySku,
    nmfcSuggestionBySku,
    manualInputs,
    setManualInputs,
    
    // Functions
    fetchAvailableOrders,
    handleOrderSelection,
    handleClassificationComplete,
    handleFinalBooking,
    updateHazmatForSku,
    updateNmfcForSku,
    suggestNmfcForSku,
    
    // Utils
    warehouseFeedback
  } = useFreightBooking();

  const getStepTitle = () => {
    switch (currentStep) {
      case 'selection': return 'Select Order to Ship';
      case 'classification': return 'Product Classification';
      case 'hazmat-analysis': return 'Hazmat Analysis';
      case 'confirmation': return 'Confirm Booking';
    }
  };

  const getStepIcon = () => {
    switch (currentStep) {
      case 'selection': return ClockIcon;
      case 'classification': return DocumentCheckIcon;
      case 'hazmat-analysis': return BeakerIcon;
      case 'confirmation': return TruckIcon;
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-gray-100">
        <FreightNavigation className="bg-white shadow-sm border-b px-6 py-4" />
        <BookingSuccess bookingData={bookingData} workspaceLink={workspaceLink} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <FreightNavigation className="bg-white shadow-sm border-b px-6 py-4" />
      
      {/* Header with Progress */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {(() => {
                const Icon = getStepIcon();
                return <Icon className="h-8 w-8 text-blue-600 mr-3" />;
              })()}
              <div>
                <h1 className="text-warehouse-3xl font-black text-gray-900 uppercase">{getStepTitle()}</h1>
                <p className="text-sm text-gray-600">Professional freight booking workflow</p>
              </div>
            </div>
            
            {/* Progress Steps */}
            <BookingStepIndicator currentStep={currentStep} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Step 1: Order Selection */}
        {currentStep === 'selection' && (
          <OrderSelectionStep
            availableOrders={availableOrders}
            loading={loading}
            onOrderSelect={handleOrderSelection}
            onRefresh={fetchAvailableOrders}
            warehouseFeedback={warehouseFeedback}
          />
        )}

        {/* Step 2: Product Classification */}
        {currentStep === 'classification' && bookingData.selectedOrder && (
          <ClassificationStep
            selectedOrder={bookingData.selectedOrder}
            classifiedItems={bookingData.classifiedItems}
            manualInputs={manualInputs}
            setManualInputs={setManualInputs}
            setBookingData={setBookingData}
            onComplete={handleClassificationComplete}
            onBack={() => setCurrentStep('selection')}
            warehouseFeedback={warehouseFeedback}
          />
        )}

        {/* Step 3: Hazmat Analysis */}
        {currentStep === 'hazmat-analysis' && bookingData.selectedOrder && (
          <HazmatAnalysisStep
            selectedOrder={bookingData.selectedOrder}
            hazmatBySku={hazmatBySku}
            hazErrorsBySku={hazErrorsBySku}
            nmfcBySku={nmfcBySku}
            nmfcSuggestionBySku={nmfcSuggestionBySku}
            updateHazmatForSku={updateHazmatForSku}
            updateNmfcForSku={updateNmfcForSku}
            suggestNmfcForSku={suggestNmfcForSku}
            onContinue={() => setCurrentStep('confirmation')}
            warehouseFeedback={warehouseFeedback}
          />
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 'confirmation' && bookingData.selectedOrder && (
          <ConfirmationStep
            bookingData={bookingData}
            palletData={palletData}
            booking={booking}
            setBookingData={setBookingData}
            onBack={() => {
              const hasHazmat = bookingData.classifiedItems.some(
                item => item.classification?.isHazmat
              );
              setCurrentStep(hasHazmat ? 'hazmat-analysis' : 'classification');
            }}
            onConfirm={handleFinalBooking}
            warehouseFeedback={warehouseFeedback}
          />
        )}
      </div>
    </div>
  );
}