"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type JsonObject = Record<string, unknown>;
type JsonObjectArray = JsonObject[];

interface TelemetryEvent {
  eventType: string;
  timestamp: number;
  data: JsonObject;
  sessionId: string;
  userId?: string;
}

interface FreightSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  orderNumber?: string;
  events: TelemetryEvent[];
  decisions: {
    carrier?: string;
    service?: string;
    containers?: JsonObjectArray;
    accessorials?: string[];
    confidence?: number;
    [key: string]: unknown;
  };
}

interface TelemetryContextType {
  currentSession: FreightSession | null;
  startSession: (orderNumber?: string) => void;
  endSession: () => void;
  captureEvent: (eventType: string, data: JsonObject) => void;
  captureDecision: (decision: Record<string, unknown>) => void;
  getSessionData: () => FreightSession | null;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(
  undefined,
);

// Provider component
export function FreightTelemetryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentSession, setCurrentSession] = useState<FreightSession | null>(
    null,
  );
  const eventsQueue = useRef<TelemetryEvent[]>([]);
  const flushTimeout = useRef<NodeJS.Timeout>();

  // Generate session ID
  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Start a new telemetry session
  const startSession = (orderNumber?: string) => {
    const newSession: FreightSession = {
      sessionId: generateSessionId(),
      startTime: Date.now(),
      orderNumber,
      events: [],
      decisions: {},
    };
    setCurrentSession(newSession);
    
    // Log session start
    console.log("[Telemetry] Session started:", newSession.sessionId);
  };

  // End the current session
  const endSession = () => {
    if (currentSession) {
      const endedSession = {
        ...currentSession,
        endTime: Date.now(),
      };
      
      // Send session data to backend
      flushSessionData(endedSession);
      
      console.log("[Telemetry] Session ended:", endedSession.sessionId);
      setCurrentSession(null);
    }
  };

  // Capture a telemetry event
  const captureEvent = (eventType: string, data: JsonObject) => {
    if (!currentSession) {
      console.warn("[Telemetry] No active session, starting new session");
      startSession();
    }

    const event: TelemetryEvent = {
      eventType,
      timestamp: Date.now(),
      data,
      sessionId: currentSession?.sessionId || "unknown",
    };

    // Add to current session
    if (currentSession) {
      setCurrentSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          events: [...prev.events, event],
        };
      });
    }

    // Add to queue for batch sending
    eventsQueue.current.push(event);

    // Schedule flush
    scheduleFlush();
  };

  // Capture a decision made by the user
  const captureDecision = (decision: Record<string, unknown>) => {
    if (!currentSession) {
      console.warn("[Telemetry] No active session for decision capture");
      return;
    }

    setCurrentSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        decisions: {
          ...prev.decisions,
          ...decision,
        },
      };
    });

    // Also capture as an event
    captureEvent("decision_made", decision);
  };

  // Get current session data
  const getSessionData = () => currentSession;

  // Schedule batch sending of events
  const scheduleFlush = () => {
    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current);
    }

    flushTimeout.current = setTimeout(() => {
      flushEvents();
    }, 5000); // Flush every 5 seconds
  };

  // Send events to backend
  const flushEvents = async () => {
    if (eventsQueue.current.length === 0) return;

    const eventsToSend = [...eventsQueue.current];
    eventsQueue.current = [];

    try {
      await fetch("/api/telemetry/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: eventsToSend }),
      });
    } catch (error) {
      console.error("[Telemetry] Failed to send events:", error);
      // Re-add events to queue for retry
      eventsQueue.current.unshift(...eventsToSend);
    }
  };

  // Send complete session data
  const flushSessionData = async (session: FreightSession) => {
    try {
      await fetch("/api/telemetry/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });
    } catch (error) {
      console.error("[Telemetry] Failed to send session data:", error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushTimeout.current) {
        clearTimeout(flushTimeout.current);
      }
      if (eventsQueue.current.length > 0) {
        flushEvents();
      }
    };
  }, []);

  return (
    <TelemetryContext.Provider
      value={{
        currentSession,
        startSession,
        endSession,
        captureEvent,
        captureDecision,
        getSessionData,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}

// Hook to use telemetry
export function useFreightTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error(
      "useFreightTelemetry must be used within FreightTelemetryProvider",
    );
  }
  return context;
}

// Helper hook for tracking component interactions
export function useTelemetryTracking(componentName: string) {
  const telemetry = useFreightTelemetry();

  const trackClick = (elementName: string, data: JsonObject = {}) => {
    telemetry.captureEvent("ui_click", {
      component: componentName,
      element: elementName,
      ...data,
    });
  };

  const trackChange = (
    fieldName: string,
    value: unknown,
    previousValue?: unknown,
  ) => {
    telemetry.captureEvent("field_change", {
      component: componentName,
      field: fieldName,
      value,
      previousValue,
    });
  };

  const trackView = (viewName: string, data: JsonObject = {}) => {
    telemetry.captureEvent("view", {
      component: componentName,
      view: viewName,
      ...data,
    });
  };

  const trackError = (error: unknown, context: JsonObject = {}) => {
    const errorObject =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown error");
    telemetry.captureEvent("error", {
      component: componentName,
      error: errorObject.message,
      stack: errorObject.stack,
      context,
    });
  };

  const trackTiming = (action: string, duration: number) => {
    telemetry.captureEvent("timing", {
      component: componentName,
      action,
      duration,
    });
  };

  return {
    trackClick,
    trackChange,
    trackView,
    trackError,
    trackTiming,
  };
}

// Hook for tracking freight-specific actions
export function useFreightActionTracking() {
  const telemetry = useFreightTelemetry();

  const trackOrderSelection = (
    orderNumber: string,
    orderData: Record<string, unknown>,
  ) => {
    telemetry.captureEvent("order_selected", {
      orderNumber,
      ...orderData,
    });
  };

  const trackCarrierSelection = (
    carrier: string,
    service: string,
    reason?: string,
  ) => {
    telemetry.captureEvent("carrier_selected", {
      carrier,
      service,
      reason,
    });
    telemetry.captureDecision({ carrier, service });
  };

  const trackContainerAssignment = (itemSku: string, containerId: string) => {
    telemetry.captureEvent("item_assigned", {
      itemSku,
      containerId,
    });
  };

  const trackAccessorialToggle = (
    accessorial: string,
    enabled: boolean,
  ) => {
    telemetry.captureEvent("accessorial_toggled", {
      accessorial,
      enabled,
    });
  };

  const trackFreightBooked = (bookingData: Record<string, unknown>) => {
    telemetry.captureEvent("freight_booked", bookingData);
    telemetry.captureDecision({
      ...bookingData,
      confidence: 1.0, // Human decision = 100% confidence
    });
  };

  const trackAISuggestionInteraction = (
    action: "accepted" | "rejected" | "modified",
    suggestion: Record<string, unknown>,
    reason?: string,
  ) => {
    telemetry.captureEvent("ai_suggestion_interaction", {
      action,
      suggestion,
      reason,
    });
  };

  return {
    trackOrderSelection,
    trackCarrierSelection,
    trackContainerAssignment,
    trackAccessorialToggle,
    trackFreightBooked,
    trackAISuggestionInteraction,
  };
}
