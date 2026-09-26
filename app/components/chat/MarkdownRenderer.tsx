import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

function MarkdownRendererComponent({ content }: MarkdownRendererProps) {
  const parts = parseMarkdown(content);

  return (
    <div 
      className="markdown-renderer"
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px', 
        lineHeight: 1.6,
        userSelect: 'text',
        WebkitUserSelect: 'text'
      }}
    >
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return <CodeBlock key={index} code={part.text} language={part.language} />;
        } else if (part.type === 'h1') {
          return <h1 key={index} style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '6px', marginBottom: '2px', userSelect: 'text' }}>{renderInline(part.text)}</h1>;
        } else if (part.type === 'h2') {
          return <h2 key={index} style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', marginTop: '6px', marginBottom: '2px', userSelect: 'text' }}>{renderInline(part.text)}</h2>;
        } else if (part.type === 'h3') {
          return <h3 key={index} style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '4px', marginBottom: '2px', userSelect: 'text' }}>{renderInline(part.text)}</h3>;
        } else if (part.type === 'h4') {
          return <h4 key={index} style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginTop: '4px', marginBottom: '2px', userSelect: 'text' }}>{renderInline(part.text)}</h4>;
        } else if (part.type === 'blockquote') {
          return (
            <blockquote 
              key={index} 
              style={{ 
                borderLeft: '3px solid #3b82f6', 
                backgroundColor: 'rgba(30, 41, 59, 0.5)', 
                padding: '6px 12px', 
                margin: '4px 0', 
                borderRadius: '0 4px 4px 0',
                color: '#cbd5e1',
                fontStyle: 'italic',
                userSelect: 'text'
              }}
            >
              {renderInline(part.text)}
            </blockquote>
          );
        } else if (part.type === 'ol') {
          return (
            <ol key={index} style={{ paddingLeft: '22px', margin: '4px 0', userSelect: 'text' }}>
              {part.items.map((item, i) => (
                <li key={i} style={{ color: '#cbd5e1', marginBottom: '2px', userSelect: 'text' }}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        } else if (part.type === 'ul') {
          return (
            <ul key={index} style={{ paddingLeft: '20px', margin: '4px 0', listStyleType: 'disc', userSelect: 'text' }}>
              {part.items.map((item, i) => (
                <li key={i} style={{ color: '#cbd5e1', marginBottom: '2px', userSelect: 'text' }}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        } else {
          return <p key={index} style={{ margin: '2px 0', color: '#e2e8f0', userSelect: 'text' }}>{renderInline(part.text)}</p>;
        }
      })}
    </div>
  );
}

export const MarkdownRenderer = React.memo(MarkdownRendererComponent, (prev, next) => {
  return prev.content === next.content;
});

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div 
      className="code-block-container"
      style={{ 
        backgroundColor: '#090d16', 
        border: '1px solid #334155', 
        borderRadius: '6px', 
        overflow: 'hidden', 
        margin: '8px 0',
        userSelect: 'text',
        WebkitUserSelect: 'text'
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '6px 12px', 
        backgroundColor: '#1e293b', 
        fontSize: '12px', 
        color: '#94a3b8',
        userSelect: 'none'
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
            color: copied ? '#10b981' : '#94a3b8', 
            cursor: 'pointer',
            fontSize: '12px'
          }}
          title="Copy code"
        >
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre 
        className="code-block-pre"
        style={{ 
          padding: '12px', 
          margin: 0, 
          fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace', 
          fontSize: '13px', 
          color: '#38bdf8', 
          overflowX: 'auto',
          whiteSpace: 'pre',
          userSelect: 'text',
          WebkitUserSelect: 'text'
        }}
      >
        <code style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{code}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string) {
  // Inline parser supporting **bold**, *italic*, `code`
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx} style={{ color: '#f8fafc', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={idx} style={{ color: '#e2e8f0', fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
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
  type: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'code' | 'ul' | 'ol' | 'blockquote';
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
  let bulletBuffer: string[] = [];
  let numberBuffer: string[] = [];

  const flushLists = () => {
    if (bulletBuffer.length > 0) {
      blocks.push({ type: 'ul', text: '', language: '', items: [...bulletBuffer] });
      bulletBuffer = [];
    }
    if (numberBuffer.length > 0) {
      blocks.push({ type: 'ol', text: '', language: '', items: [...numberBuffer] });
      numberBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      flushLists();
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
      if (numberBuffer.length > 0) flushLists();
      bulletBuffer.push(line.slice(2).trim());
      continue;
    } 

    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (bulletBuffer.length > 0) flushLists();
      numberBuffer.push(numMatch[2].trim());
      continue;
    }

    flushLists();

    if (line.startsWith('> ')) {
      blocks.push({ type: 'blockquote', text: line.slice(2).trim(), language: '', items: [] });
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim(), language: '', items: [] });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim(), language: '', items: [] });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim(), language: '', items: [] });
    } else if (line.startsWith('#### ')) {
      blocks.push({ type: 'h4', text: line.slice(5).trim(), language: '', items: [] });
    } else if (line.trim() !== '') {
      blocks.push({ type: 'p', text: line.trim(), language: '', items: [] });
    }
  }

  flushLists();

  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({ type: 'code', text: codeBuffer.join('\n'), language: codeLang, items: [] });
  }

  return blocks;
}

