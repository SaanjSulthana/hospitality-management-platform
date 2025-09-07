import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PageTitleContextType {
  title: string;
  description: string;
  setPageTitle: (title: string, description: string) => void;
  clearPageTitle: () => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined);

interface PageTitleProviderProps {
  children: ReactNode;
}

export function PageTitleProvider({ children }: PageTitleProviderProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const setPageTitle = (newTitle: string, newDescription: string) => {
    setTitle(newTitle);
    setDescription(newDescription);
  };

  const clearPageTitle = () => {
    setTitle('');
    setDescription('');
  };

  return (
    <PageTitleContext.Provider value={{ title, description, setPageTitle, clearPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  const context = useContext(PageTitleContext);
  if (context === undefined) {
    throw new Error('usePageTitle must be used within a PageTitleProvider');
  }
  return context;
}
