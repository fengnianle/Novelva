import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { SelectionAskDialog } from './SelectionAskDialog';

interface SelectionAskButtonProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const SelectionAskButton: React.FC<SelectionAskButtonProps> = ({ containerRef }) => {
  const [selectedText, setSelectedText] = useState('');
  const [buttonPos, setButtonPos] = useState<{ top: number; left: number } | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const handleMouseUp = useCallback(() => {
    // Small delay so selection is finalized
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';

      if (text.length < 2) {
        // Only hide button if dialog is not open
        if (!showDialog) {
          setButtonPos(null);
          setSelectedText('');
        }
        return;
      }

      // Check if selection is within our container
      if (containerRef.current && selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (!containerRef.current.contains(range.commonAncestorContainer)) return;

        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setAnchorRect(rect);
        setButtonPos({
          top: rect.bottom + 6,
          left: rect.left + rect.width / 2 - 16,
        });
      }
    }, 10);
  }, [containerRef, showDialog]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [containerRef, handleMouseUp]);

  // Close everything when selection is cleared elsewhere
  useEffect(() => {
    const handleSelectionChange = () => {
      const text = window.getSelection()?.toString().trim() || '';
      if (text.length < 2 && !showDialog) {
        setButtonPos(null);
        setSelectedText('');
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [showDialog]);

  const handleOpenDialog = useCallback(() => {
    setShowDialog(true);
    setButtonPos(null); // Hide the button once dialog opens
  }, []);

  const handleCloseDialog = useCallback(() => {
    setShowDialog(false);
    setSelectedText('');
    setButtonPos(null);
    // Clear selection
    window.getSelection()?.removeAllRanges();
  }, []);

  return (
    <>
      {buttonPos && !showDialog && (
        <button
          className="fixed z-[60] w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all flex items-center justify-center animate-in fade-in-0 zoom-in-90 duration-150"
          style={{ top: buttonPos.top, left: buttonPos.left }}
          onClick={handleOpenDialog}
          title="对选中文本提问"
        >
          <MessageSquare size={14} />
        </button>
      )}
      {showDialog && anchorRect && selectedText && (
        <SelectionAskDialog
          selectedText={selectedText}
          anchorRect={anchorRect}
          onClose={handleCloseDialog}
        />
      )}
    </>
  );
};
