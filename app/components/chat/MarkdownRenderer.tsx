import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const parts = parseMarkdown(content);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.6 }}>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return <CodeBlock key={index} code={part.text} language={part.language} />;
        } else if (part.type === 'h3') {
          return <h3 key={index} style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>{renderInline(part.text)}</h3>;
        } else if (part.type === 'h4') {
          return <h4 key={index} style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginTop: '4px' }}>{renderInline(part.text)}</h4>;
        } else if (part.type === 'ul') {
          return (
            <ul key={index} style={{ paddingLeft: '20px', margin: '4px 0', listStyleType: 'disc' }}>
              {part.items.map((item, i) => (
                <li key={i} style={{ color: '#cbd5e1', marginBottom: '2px' }}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        } else {
          return <p key={index} style={{ margin: '2px 0', color: '#e2e8f0' }}>{renderInline(part.text)}</p>;
        }
      })}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ 
      backgroundColor: '#090d16', 
      border: '1px solid #334155', 
      borderRadius: '6px', 
      overflow: 'hidden', 
      margin: '8px 0' 
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '6px 12px', 
        backgroundColor: '#1e293b', 
        fontSize: '12px', 
        color: '#94a3b8' 
      }}>
        <span>{language || 'code'}</span>
        <button 
          onClick={handleCopy}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            background: 'none', 
            border: 'none', 
            color: '#94a3b8', 
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre style={{ 
        padding: '12px', 
        margin: 0, 
        fontFamily: 'monospace', 
        fontSize: '13px', 
        color: '#38bdf8', 
        overflowX: 'auto',
        whiteSpace: 'pre-wrap'
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string) {
  // Simple inline parser for **bold** and `code`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} style={{ color: '#f8fafc', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    } else if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code 
          key={idx} 
          style={{ 
            backgroundColor: '#1e293b', 
            color: '#38bdf8', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            fontSize: '13px',
            fontFamily: 'monospace'
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

interface ParsedBlock {
  type: 'p' | 'h3' | 'h4' | 'code' | 'ul';
  text: string;
  language: string;
  items: string[];
}

function parseMarkdown(text: string): ParsedBlock[] {
  const lines = text.split('\n');
  const blocks: ParsedBlock[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: 'ul', text: '', language: '', items: [...listBuffer] });
      listBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      flushList();
      if (inCodeBlock) {
        blocks.push({ type: 'code', text: codeBuffer.join('\n'), language: codeLang, items: [] });
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(line.slice(2).trim());
      continue;
    } else {
      flushList();
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim(), language: '', items: [] });
    } else if (line.startsWith('#### ')) {
      blocks.push({ type: 'h4', text: line.slice(5).trim(), language: '', items: [] });
    } else if (line.trim() !== '') {
      blocks.push({ type: 'p', text: line.trim(), language: '', items: [] });
    }
  }

  flushList();

  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({ type: 'code', text: codeBuffer.join('\n'), language: codeLang, items: [] });
  }

  return blocks;
}
