import React from 'react';
import { IS_ADVERTISING_ENABLED } from '@config/ad';

interface AdWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AdWrapper: React.FC<AdWrapperProps> = ({ children, fallback = null }) => {
  if (!IS_ADVERTISING_ENABLED) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};