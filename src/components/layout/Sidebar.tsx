import React from 'react';
import { BookOpen, Library, GraduationCap, Settings } from 'lucide-react';
import { useReaderStore, ViewMode } from '../../stores/reader-store';
import { cn } from '../../lib/utils';
import appIconUrl from '../../../resources/icon-48.png';

interface NavItem {
  icon: React.ElementType;
  label: string;
  mode: ViewMode;
}

const navItems: NavItem[] = [
  { icon: BookOpen, label: '阅读', mode: 'reader' },
  { icon: Library, label: '词汇本', mode: 'vocabulary' },
  { icon: GraduationCap, label: '复习', mode: 'review' },
  { icon: Settings, label: '设置', mode: 'settings' },
];

export const Sidebar: React.FC = () => {
  const { viewMode, setViewMode } = useReaderStore();

  return (
    <aside className="w-[68px] bg-secondary/30 border-r border-border flex flex-col items-center">
      <div className="w-full flex flex-col items-center pt-3 pb-2">
        <button
          onClick={() => window.open('https://github.com/fengnianle/Novelva', '_blank')}
          className="w-9 h-9 rounded-xl overflow-hidden shadow-sm hover:opacity-80 transition-opacity cursor-pointer"
          title="访问 GitHub 仓库"
        >
          <img src={appIconUrl} alt="Novelva" className="w-full h-full object-cover" />
        </button>
        <span className="text-[9px] font-medium text-muted-foreground mt-1 tracking-tight">Novelva</span>
      </div>

      <div className="flex flex-col items-center gap-1 mt-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = viewMode === item.mode;
          return (
            <button
              key={item.mode}
              onClick={() => setViewMode(item.mode)}
              className={cn(
                'w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-xs',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={item.label}
            >
              <Icon size={20} />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
