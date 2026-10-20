import { useCallback, useEffect, useState } from 'react';

/** Modo proyección: pantalla completa de toda la aplicación mediante la Fullscreen API. */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    request.catch((err: unknown) => console.warn('Pantalla completa no disponible', err));
  }, []);

  return { isFullscreen, toggle, supported: document.fullscreenEnabled };
}
