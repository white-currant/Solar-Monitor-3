import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';

export const InstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Handle Install Prompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  // Don't show anything if already installed
  if (isStandalone) return null;

  // Don't show if not iOS and no prompt available (e.g. Firefox or already dismissed)
  if (!isIOS && !deferredPrompt) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="fixed bottom-6 right-6 z-[9999] bg-[#00bcd4] text-black font-bold px-4 py-3 rounded-full shadow-[0_0_20px_rgba(0,188,212,0.4)] hover:scale-105 transition-transform flex items-center gap-2 animate-in fade-in slide-in-from-bottom-10 duration-500"
        title="Установить приложение"
      >
        <Download size={20} />
        <span className="hidden md:inline uppercase text-xs tracking-wider">Установить App</span>
      </button>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div 
            className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={() => setShowIOSInstructions(false)}
        >
            <div 
                className="bg-[#1e293b] border border-white/10 text-white p-6 rounded-2xl max-w-sm w-full relative shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={() => setShowIOSInstructions(false)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center">
                    <div className="bg-white/10 p-3 rounded-xl mb-4">
                        <Smartphone size={32} className="text-[#00bcd4]" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Установка на iPhone</h3>
                    <p className="text-gray-400 text-sm mb-4">
                        Приложения PWA устанавливаются через меню браузера Safari.
                    </p>
                    
                    <div className="bg-black/30 rounded-lg p-4 w-full text-left space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 bg-gray-700 rounded-full text-xs font-bold">1</span>
                            <span>Нажмите кнопку <span className="inline-flex align-middle mx-1"><Share size={14} /></span> <strong>Поделиться</strong> внизу экрана.</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 bg-gray-700 rounded-full text-xs font-bold">2</span>
                            <span>Прокрутите вниз и выберите <strong>"На экран «Домой»"</strong>.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
