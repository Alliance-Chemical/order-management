'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { TruckIcon } from '@heroicons/react/24/solid';

interface FreightOrder {
  orderId: number;
  orderNumber: string;
  customerName?: string;
  orderDate?: string;
  items?: any[];
}

interface FreightAlertContextType {
  newOrderCount: number;
  unseenOrders: FreightOrder[];
  markOrderAsSeen: (orderId: number) => void;
  clearAllNotifications: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

const FreightAlertContext = createContext<FreightAlertContextType | undefined>(undefined);

const STORAGE_KEY = 'freight_orders_seen';
const SOUND_PREFERENCE_KEY = 'freight_alert_sound';
const POLL_INTERVAL = 30000; // 30 seconds
const RETENTION_DAYS = 7;

export function FreightAlertProvider({ children }: { children: React.ReactNode }) {
  const [unseenOrders, setUnseenOrders] = useState<FreightOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastCheckRef = useRef<number>(Date.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load preferences on mount
  useEffect(() => {
    const savedSound = localStorage.getItem(SOUND_PREFERENCE_KEY);
    setSoundEnabled(savedSound !== 'false');
    
    // Create audio element for notification sound
    audioRef.current = new Audio('data:audio/wav;base64,UklGRlQCAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTACAAAAAAIAAgACAAIAAgACAAIAAgACAAMAAwADAAMAAwADAAMAAwAEAAQABAAEAAQABAAEAAUABQAFAAUABQAGAAYABgAGAAYABwAHAAcABwAIAAgACAAIAAkACQAJAAkACgAKAAoACwALAAsADAAMAAwADQANAA0ADgAOAA8ADwAPABAAEAARABEAEgASABMAEwATABQAFAAVABUAFgAWABcAFwAYABgAGQAaABoAGwAbABwAHQAdAB4AHwAfACAAIQAhACIAIwAkACQAJQAmACcAJwAoACkAKgArACwALQAtAC8AMAAxADEAMwA0ADUANgA3ADgAOQA7ADwAPQA+AD8AQQBCAEMARABGAEcASABKAEsATQBOAFAAUQBTAFQAVgBXAFkAWwBcAF4AYABhAGMAZQBnAGkAawBsAG4AcAByAHQAdgB4AHoAfAB+AIABggGEAYYBiAGKAY0BjwGRAZMBlgGYAZoBnQGfAaEBpAGmAagBqwGtAbABsgG1AbcBugG8Ab8BwQHEAcYByQHMAs4C0QLUAtYC2QLcAt8C4gLkAucC6gLtAvAC8wL2AvkC/AL/AgIDBQMIAwsDDwMSAxUDGAMcAx8DIgMlAykDLAMwAzMDNwM6Az0DQQNEA0gDSwNPA1IDVQNZA10DYAN=');
    audioRef.current.volume = 0.3; // Subtle volume
  }, []);

  // Clean up old seen orders
  const cleanupOldOrders = useCallback(() => {
    const seenOrders = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const cutoffTime = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    const cleaned = Object.entries(seenOrders).reduce((acc, [orderId, timestamp]) => {
      if ((timestamp as number) > cutoffTime) {
        acc[orderId] = timestamp;
      }
      return acc;
    }, {} as Record<string, number>);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    return cleaned;
  }, []);

  // Check for new freight orders
  const checkForNewOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/freight-orders/poll');
      if (!response.ok) return;
      
      const data = await response.json();
      if (!data.success) return;
      
      const seenOrders = cleanupOldOrders();
      const allOrders = [...(data.created || []), ...(data.existing || [])];
      
      // Find genuinely new orders
      const newOrders = allOrders.filter(order => {
        const orderIdStr = String(order.orderId);
        const isNew = !seenOrders[orderIdStr];
        
        // Check if order was created after our last check
        if (isNew && order.orderDate) {
          const orderTime = new Date(order.orderDate).getTime();
          if (orderTime > lastCheckRef.current - POLL_INTERVAL) {
            return true;
          }
        }
        return false;
      });
      
      if (newOrders.length > 0) {
        setUnseenOrders(prev => [...newOrders, ...prev]);
        
        // Show notifications for each new order
        newOrders.forEach(order => {
          toast({
            title: (
              <div className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-blue-600" />
                <span>New Freight Order</span>
              </div>
            ),
            description: (
              <div>
                <p className="font-semibold">Order #{order.orderNumber}</p>
                <p className="text-sm text-gray-600">{order.customerName || 'Unknown Customer'}</p>
              </div>
            ),
            action: (
              <a
                href={`/freight-booking?orderId=${order.orderId}`}
                className="inline-flex items-center px-3 py-1 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                View Order
              </a>
            ),
          });
        });
        
        // Play sound if enabled
        if (soundEnabled && audioRef.current) {
          audioRef.current.play().catch(() => {
            // Ignore audio play errors (browser may block autoplay)
          });
        }
      }
      
      lastCheckRef.current = Date.now();
    } catch (error) {
      console.error('Error checking for new freight orders:', error);
    }
  }, [soundEnabled, cleanupOldOrders]);

  // Mark order as seen
  const markOrderAsSeen = useCallback((orderId: number) => {
    const seenOrders = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    seenOrders[String(orderId)] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seenOrders));
    
    setUnseenOrders(prev => prev.filter(order => order.orderId !== orderId));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    const seenOrders = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    unseenOrders.forEach(order => {
      seenOrders[String(order.orderId)] = Date.now();
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seenOrders));
    setUnseenOrders([]);
  }, [unseenOrders]);

  // Toggle sound preference
  const toggleSound = useCallback(() => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem(SOUND_PREFERENCE_KEY, String(newValue));
  }, [soundEnabled]);

  // Set up polling
  useEffect(() => {
    // Initial check
    checkForNewOrders();
    
    // Set up interval
    const interval = setInterval(checkForNewOrders, POLL_INTERVAL);
    
    // Also check when window regains focus
    const handleFocus = () => {
      checkForNewOrders();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForNewOrders]);

  return (
    <FreightAlertContext.Provider
      value={{
        newOrderCount: unseenOrders.length,
        unseenOrders,
        markOrderAsSeen,
        clearAllNotifications,
        soundEnabled,
        toggleSound,
      }}
    >
      {children}
    </FreightAlertContext.Provider>
  );
}

export function useFreightAlerts() {
  const context = useContext(FreightAlertContext);
  if (context === undefined) {
    throw new Error('useFreightAlerts must be used within a FreightAlertProvider');
  }
  return context;
}