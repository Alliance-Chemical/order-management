import { useState, useEffect, useCallback } from 'react';

interface Container {
  id: string;
  number: number;
  scanned: boolean;
  inspected: boolean;
  issues: string[];
  qrData?: string;
}

interface InspectionQuestion {
  id: string;
  label: string;
  icon: string;
}

interface UseMultiContainerInspectionProps {
  quantity: number;
  containerType: 'tote' | 'drum' | 'pail' | 'bottle';
  onComplete: (results: any) => void;
}

const INSPECTION_QUESTIONS: Record<string, InspectionQuestion[]> = {
  tote: [
    { id: 'clean', label: 'Is the container clean?', icon: '✨' },
    { id: 'sealed', label: 'Is the seal intact?', icon: '🔒' },
    { id: 'label', label: 'Is the label correct?', icon: '🏷️' },
    { id: 'damage', label: 'No visible damage?', icon: '✅' },
  ],
  drum: [
    { id: 'clean', label: 'Is the drum clean?', icon: '✨' },
    { id: 'sealed', label: 'Is the bung sealed?', icon: '🔒' },
    { id: 'label', label: 'Is the label correct?', icon: '🏷️' },
    { id: 'damage', label: 'No dents or damage?', icon: '✅' },
  ],
  pail: [
    { id: 'clean', label: 'Is the pail clean?', icon: '✨' },
    { id: 'lid', label: 'Is the lid secure?', icon: '🔒' },
    { id: 'label', label: 'Is the label correct?', icon: '🏷️' },
  ],
  bottle: [
    { id: 'clean', label: 'Is the bottle clean?', icon: '✨' },
    { id: 'cap', label: 'Is the cap secure?', icon: '🔒' },
    { id: 'label', label: 'Is the label correct?', icon: '🏷️' },
  ],
};

export function useMultiContainerInspection({
  quantity,
  containerType,
  onComplete,
}: UseMultiContainerInspectionProps) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [currentContainer, setCurrentContainer] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<{ 
    container: number; 
    question: string;
  } | null>(null);
  const [scanSpeed, setScanSpeed] = useState<number>(0);
  const [lastScanTime, setLastScanTime] = useState<number>(0);

  const questions = INSPECTION_QUESTIONS[containerType] || INSPECTION_QUESTIONS.tote;

  // Initialize containers
  useEffect(() => {
    const containerList: Container[] = [];
    for (let i = 0; i < quantity; i++) {
      containerList.push({
        id: `container-${i}`,
        number: i + 1,
        scanned: false,
        inspected: false,
        issues: [],
      });
    }
    setContainers(containerList);

    // Auto-open scanner for first container
    if (containerList.length > 0) {
      setShowScanner(true);
    }
  }, [quantity]);

  const handleQRScan = useCallback((qrData: string) => {
    const scanTime = Date.now();
    const timeDiff = lastScanTime ? (scanTime - lastScanTime) / 1000 : 0;
    
    // Calculate scan speed
    if (lastScanTime) {
      setScanSpeed(Math.round(1 / timeDiff * 10) / 10); // Scans per second
    }
    setLastScanTime(scanTime);

    // Update container as scanned
    setContainers(prev => {
      const updated = [...prev];
      updated[currentContainer].scanned = true;
      updated[currentContainer].qrData = qrData;
      return updated;
    });

    // Close scanner and move to inspection questions
    setShowScanner(false);
    setCurrentQuestion(0);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]); // Double vibration for success
    }
  }, [currentContainer, lastScanTime]);

  const completeInspection = useCallback(() => {
    const results = {
      containers: containers.map(c => ({
        number: c.number,
        qrData: c.qrData,
        inspected: c.inspected,
        issues: c.issues,
      })),
      completedAt: new Date().toISOString(),
      averageScanSpeed: scanSpeed,
    };
    onComplete(results);
  }, [containers, scanSpeed, onComplete]);

  const handleQuestionPass = useCallback(() => {
    if (currentQuestion < questions.length - 1) {
      // Move to next question
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // All questions passed for this container
      setContainers(prev => {
        const updated = [...prev];
        updated[currentContainer].inspected = true;
        return updated;
      });

      if (currentContainer < containers.length - 1) {
        // Move to next container
        setCurrentContainer(currentContainer + 1);
        setCurrentQuestion(0);
        setShowScanner(true);
      } else {
        // All containers inspected
        completeInspection();
      }
    }
  }, [currentQuestion, currentContainer, questions.length, containers.length, completeInspection]);

  const handleQuestionFail = useCallback(() => {
    setCurrentIssue({
      container: currentContainer,
      question: questions[currentQuestion].label,
    });
    setShowIssueModal(true);
  }, [currentContainer, currentQuestion, questions]);

  const handleIssueReported = useCallback((reason: string) => {
    setContainers(prev => {
      const updated = [...prev];
      updated[currentContainer].issues.push(
        `${questions[currentQuestion].label}: ${reason}`
      );
      return updated;
    });
    setShowIssueModal(false);

    // Move to next question or container
    handleQuestionPass();
  }, [currentContainer, currentQuestion, questions, handleQuestionPass]);

  const getContainerStatus = useCallback((index: number) => {
    const container = containers[index];
    if (!container) return 'pending';
    if (container.inspected) return 'completed';
    if (container.scanned) return 'scanning';
    if (index === currentContainer) return 'current';
    return 'pending';
  }, [containers, currentContainer]);

  const progress = containers.length > 0 
    ? (containers.filter(c => c.inspected).length / containers.length) * 100 
    : 0;

  const stats = {
    scanned: containers.filter(c => c.scanned).length,
    inspected: containers.filter(c => c.inspected).length,
    remaining: containers.length - containers.filter(c => c.inspected).length,
  };

  return {
    // State
    containers,
    currentContainer,
    currentQuestion,
    showScanner,
    showIssueModal,
    currentIssue,
    scanSpeed,
    questions,
    progress,
    stats,
    
    // Actions
    setShowScanner,
    setShowIssueModal,
    handleQRScan,
    handleQuestionPass,
    handleQuestionFail,
    handleIssueReported,
    getContainerStatus,
  };
}