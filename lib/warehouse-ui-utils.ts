/**
 * Warehouse UI Utilities
 * Enhanced feedback systems for warehouse workers
 */

// Haptic feedback patterns for different actions
export const hapticFeedback = {
  // Light tap for button press
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  },
  
  // Medium feedback for success
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]); // Double tap pattern
    }
  },
  
  // Strong feedback for errors/warnings
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]); // Triple buzz
    }
  },
  
  // Quick pulse for scan
  scan: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 25, 50]); // Quick double pulse
    }
  },
  
  // Long vibration for critical alerts
  alert: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(500);
    }
  }
};

// Sound effects using Web Audio API for better performance
class SoundEffects {
  private audioContext: AudioContext | null = null;
  
  private initContext() {
    if (!this.audioContext && typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }
  
  // Play a beep sound with specified frequency and duration
  private playTone(frequency: number, duration: number, volume: number = 0.3) {
    const context = this.initContext();
    if (!context) return;
    
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration / 1000);
  }
  
  // Success sound - ascending tone
  success() {
    this.playTone(523, 100); // C5
    setTimeout(() => this.playTone(659, 150), 100); // E5
    setTimeout(() => this.playTone(784, 200), 250); // G5
  }
  
  // Error sound - descending tone
  error() {
    this.playTone(784, 100); // G5
    setTimeout(() => this.playTone(659, 100), 100); // E5
    setTimeout(() => this.playTone(523, 200), 200); // C5
  }
  
  // Button click - single beep
  click() {
    this.playTone(600, 50, 0.2);
  }
  
  // Warning - alternating tones
  warning() {
    this.playTone(880, 150); // A5
    setTimeout(() => this.playTone(659, 150), 150); // E5
    setTimeout(() => this.playTone(880, 150), 300); // A5
  }
  
  // Scan sound - quick chirp
  scan() {
    this.playTone(1047, 50); // C6
    setTimeout(() => this.playTone(1319, 50), 50); // E6
  }
  
  // Complete/celebration - fanfare
  complete() {
    this.playTone(523, 100); // C5
    setTimeout(() => this.playTone(659, 100), 100); // E5
    setTimeout(() => this.playTone(784, 100), 200); // G5
    setTimeout(() => this.playTone(1047, 300), 300); // C6
  }
}

// Export singleton instance
export const soundEffects = new SoundEffects();

// Combined feedback for common actions
export const warehouseFeedback = {
  buttonPress: () => {
    hapticFeedback.light();
    soundEffects.click();
  },
  
  success: () => {
    hapticFeedback.success();
    soundEffects.success();
  },
  
  error: () => {
    hapticFeedback.warning();
    soundEffects.error();
  },
  
  warning: () => {
    hapticFeedback.warning();
    soundEffects.warning();
  },
  
  scan: () => {
    hapticFeedback.scan();
    soundEffects.scan();
  },
  
  complete: () => {
    hapticFeedback.success();
    soundEffects.complete();
  }
};

// Visual feedback utilities
export const visualFeedback = {
  // Flash element with color
  flash: (element: HTMLElement, color: 'green' | 'red' | 'yellow' = 'green') => {
    const originalBg = element.style.backgroundColor;
    const flashColor = {
      green: '#00873E',
      red: '#CC0000',
      yellow: '#F5A623'
    }[color];
    
    element.style.transition = 'background-color 0.2s';
    element.style.backgroundColor = flashColor;
    
    setTimeout(() => {
      element.style.backgroundColor = originalBg;
      setTimeout(() => {
        element.style.transition = '';
      }, 200);
    }, 200);
  },
  
  // Shake element for error
  shake: (element: HTMLElement) => {
    element.style.animation = 'errorShake 0.5s';
    setTimeout(() => {
      element.style.animation = '';
    }, 500);
  },
  
  // Pulse element for attention
  pulse: (element: HTMLElement) => {
    element.style.animation = 'pulseStrong 2s';
    setTimeout(() => {
      element.style.animation = '';
    }, 2000);
  }
};

// Utility to check if device supports haptic feedback
export const supportsHaptic = () => 'vibrate' in navigator;

// Utility to check if device supports audio
export const supportsAudio = () => typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined';

// Get device type for UI adjustments
export const getDeviceType = (): 'phone' | 'tablet' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  if (width < 768) return 'phone';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

// Check if user is likely wearing gloves (based on touch event characteristics)
export const detectGloveMode = (touchEvent?: TouchEvent): boolean => {
  if (!touchEvent || !touchEvent.touches[0]) return false;
  
  // Gloves typically create larger touch areas
  const touch = touchEvent.touches[0];
  const radiusX = (touch as any).radiusX || (touch as any).webkitRadiusX || 0;
  const radiusY = (touch as any).radiusY || (touch as any).webkitRadiusY || 0;
  const force = (touch as any).force || (touch as any).webkitForce || 0;
  
  // Gloves typically have larger touch radius and different force characteristics
  return radiusX > 20 || radiusY > 20 || force < 0.5;
};

// Format text for warehouse display (ALL CAPS for critical info)
export const formatWarehouseText = (text: string, type: 'normal' | 'critical' | 'action' = 'normal'): string => {
  switch(type) {
    case 'critical':
      return text.toUpperCase();
    case 'action':
      return text.toUpperCase();
    default:
      return text;
  }
};

// Create physical-looking button press effect
export const createButtonPressEffect = (button: HTMLButtonElement) => {
  button.addEventListener('mousedown', () => {
    button.style.transform = 'scale(0.95)';
    button.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
  });
  
  button.addEventListener('mouseup', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '';
  });
  
  button.addEventListener('touchstart', () => {
    button.style.transform = 'scale(0.95)';
    button.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
  });
  
  button.addEventListener('touchend', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '';
  });
};