'use client';

import React, { createContext, useContext } from 'react';

const ClassificationContext = createContext({});

export function ClassificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClassificationContext.Provider value={{}}>
      {children}
    </ClassificationContext.Provider>
  );
}

export function useClassification() {
  return {
    classifications: [],
    isLoading: false,
    error: null
  };
}