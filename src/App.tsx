import React, { useEffect, useState } from 'react';
import { useSettingsStore } from './stores/settings-store';
import { useReaderStore } from './stores/reader-store';
import { Sidebar } from './components/layout/Sidebar';
import { ReaderView } from './components/reader/ReaderView';
import { VocabularyList } from './components/vocabulary/VocabularyList';
import { FlashCard } from './components/review/FlashCard';
import { SettingsPanel } from './components/settings/SettingsPanel';

const App: React.FC = () => {
  const { loadSettings } = useSettingsStore();
  const viewMode = useReaderStore((s) => s.viewMode);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    loadSettings();
    (window as any).electronAPI?.getAppVersion?.().then((v: string) => setAppVersion(v || ''));
  }, [loadSettings]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top drag bar — spans entire window width for easy dragging */}
      <div
        className="h-9 shrink-0 w-full flex items-center px-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-xs text-muted-foreground/60 select-none">
          Novelva {appVersion && <span className="text-[10px]">v{appVersion}</span>}
        </span>
      </div>
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <div className="h-full" style={{ display: viewMode === 'reader' ? 'block' : 'none' }}>
            <ReaderView />
          </div>
          <div className="h-full" style={{ display: viewMode === 'vocabulary' ? 'block' : 'none' }}>
            <VocabularyList />
          </div>
          <div className="h-full" style={{ display: viewMode === 'review' ? 'block' : 'none' }}>
            <FlashCard />
          </div>
          <div className="h-full" style={{ display: viewMode === 'settings' ? 'block' : 'none' }}>
            <SettingsPanel />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
