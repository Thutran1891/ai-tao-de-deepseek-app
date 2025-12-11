import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css'; 

// --- ĐÃ XÓA DÒNG IMPORT BỊ LỖI Ở ĐÂY ---

interface LatexTextProps {
  text: string;
}

export const LatexText: React.FC<LatexTextProps> = ({ text }) => {
  const renderedContent = useMemo(() => {
    if (!text) return null;

    const parts = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[\s\S]*?\$)/g);
    
    return parts.map((part, index) => {
        if (part.startsWith('$') || part.startsWith('\\[')) {
            const isBlock = part.startsWith('$$') || part.startsWith('\\[');
            const content = isBlock ? part.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, '') : part.slice(1, -1);
            
            try {
                const html = katex.renderToString(content, { 
                    throwOnError: false, 
                    displayMode: isBlock,
                    output: 'html' 
                });
                
                return isBlock 
                    ? <div key={index} dangerouslySetInnerHTML={{ __html: html }} className="my-2 text-center overflow-x-auto" />
                    : <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
            } catch (error) {
                console.error("Katex error:", error);
                return <span key={index} className="text-red-500">{part}</span>;
            }
        } else {
            return <span key={index}>{part}</span>;
        }
    });
  }, [text]);

  return <>{renderedContent}</>;
};