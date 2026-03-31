'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // 개발 환경에서는 서비스 워커를 등록하지 않고, 기존 등록을 해제
      if (process.env.NODE_ENV === 'development') {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) reg.unregister();
        });
        return;
      }
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return null;
}
