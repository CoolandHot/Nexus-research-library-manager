
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Globe } from 'lucide-react';
import { TreeItem, Paper } from '../types';

interface TreeNodeProps {
  item: TreeItem;
  level: number;
  isActive: boolean;
  onSelectFolder: (id: string | null) => void;
  onDropPaper: (paperId: string, folderId: string | null) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ item, level, isActive, onSelectFolder, onDropPaper }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handlePaperClick = (paper: Paper) => {
    const target = paper.pdf_link || paper.url;
    if (target) window.open(target, '_blank');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const paperId = e.dataTransfer.getData('paperId');
    if (paperId) {
      onDropPaper(paperId, item.id === 'unfiled' ? null : item.id);
    }
  };

  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-1.5 px-2 hover:bg-slate-100 cursor-pointer rounded-md group transition-all ${isActive ? 'bg-blue-50 border-r-2 border-blue-500' : ''} ${isDragOver ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          onSelectFolder(item.id === 'unfiled' ? null : item.id);
          setIsOpen(!isOpen);
        }}
      >
        <span className="mr-1 text-slate-400">
          {item.children.length > 0 || item.papers.length > 0 ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div className="w-[14px]" />
          )}
        </span>
        <Folder className={`mr-2 ${isActive ? 'text-blue-600' : 'text-blue-400'}`} size={16} />
        <span className={`text-sm font-medium truncate ${isActive ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>{item.name}</span>
      </div>

      {isOpen && (
        <div className="mt-0.5">
          {item.children.map(child => (
            <TreeNode 
              key={child.id} 
              item={child} 
              level={level + 1} 
              isActive={false} 
              onSelectFolder={onSelectFolder}
              onDropPaper={onDropPaper}
            />
          ))}
          {item.papers.map(paper => (
            <div 
              key={paper.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('paperId', paper.id);
              }}
              className="flex items-center py-1.5 px-2 hover:bg-blue-50 cursor-pointer rounded-md group transition-colors"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
              onClick={(e) => {
                e.stopPropagation();
                handlePaperClick(paper);
              }}
            >
              {paper.type === 'pdf' || paper.pdf_link ? (
                <FileText className="mr-2 text-red-400" size={16} />
              ) : (
                <Globe className="mr-2 text-emerald-400" size={16} />
              )}
              <span className="text-xs text-slate-600 truncate">{paper.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
