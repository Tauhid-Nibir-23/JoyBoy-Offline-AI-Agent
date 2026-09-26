import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Trash2, RotateCw } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { chatService } from '../../../ai/chatService';
import { ChatMessage } from '../../../ai/provider';
import { DBConversation, DBDocument } from '../../../database/db';
import { documentService } from '../../../documents/documentService';
import { StudyActionType } from '../../../study/types';
import { ragService } from '../../../rag';
import { globalStatus } from '../../../core/status';
import { modelManager } from '../../../models/manager';

export interface ChatViewProps {
  initialConversationId?: string | null;
  onOpenModelManager?: () => void;
  onConversationsChange?: () => void;
  onNavigateToStudy?: (docId: string, action: StudyActionType) => void;
}

export function ChatView({ 
  initialConversationId, 
  onOpenModelManager,
  onConversationsChange,
  onNavigateToStudy
}: ChatViewProps = {}) {
  const [activeId, setActiveId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useStudyMaterials, setUseStudyMaterials] = useState<boolean>(chatService.isStudyMaterialsEnabled());
  const [indexedDocCount, setIndexedDocCount] = useState<number>(0);
  const [isModelInstalled, setIsModelInstalled] = useState<boolean>(false);
  const [attachedDocs, setAttachedDocs] = useState<DBDocument[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const tokenBufferRef = useRef<string>('');
  const rafIdRef = useRef<number | null>(null);
  const lastFlushTimeRef = useRef<number>(0);

  // Cancel any animation frames on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const handleStreamToken = (token: string, accumulated: string) => {
    tokenBufferRef.current = accumulated;
    const now = performance.now();
    // Batch UI updates every ~40ms (~25 fps) to eliminate main-thread freezing during high-speed generation
    if (now - lastFlushTimeRef.current >= 40) {
      lastFlushTimeRef.current = now;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setStreamingContent(accumulated);
    } else if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        lastFlushTimeRef.current = performance.now();
        setStreamingContent(tokenBufferRef.current);
      });
    }
  };

  const flushStreamTokenBuffer = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (tokenBufferRef.current) {
      setStreamingContent(tokenBufferRef.current);
    }
    tokenBufferRef.current = '';
  };

  useEffect(() => {
    updateRAGStats();
    checkModelInstalled();
  }, []);

  useEffect(() => {
    if (initialConversationId !== undefined) {
      setActiveId(initialConversationId);
      if (initialConversationId) {
        loadConversationMessages(initialConversationId);
        loadAttachedDocs(initialConversationId);
      } else {
        setMessages([]);
        setAttachedDocs([]);
      }
    }
  }, [initialConversationId]);

  const checkModelInstalled = async () => {
    let active = modelManager.getActiveModel();
    if (!active || !active.path) {
      active = await modelManager.autoSelectModel();
    }
    const hasModel = !!(active && active.path && (active.status === 'Ready' || active.status === 'Installed'));
    setIsModelInstalled(hasModel);
  };

  const updateRAGStats = () => {
    try {
      const stats = ragService.getIndexingStats();
      setIndexedDocCount(stats.indexedDocuments);
    } catch {
      // fallback
    }
  };

  const loadConversationMessages = (convId: string | null) => {
    if (!convId) {
      setMessages([]);
      return;
    }
    try {
      const msgs = chatService.getMessages(convId);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  };

  const loadAttachedDocs = (convId: string | null) => {
    if (!convId) {
      setAttachedDocs([]);
      return;
    }
    try {
      const docs = chatService.getAttachedDocuments(convId);
      setAttachedDocs(docs);
    } catch {
      setAttachedDocs([]);
    }
  };

  const handleAttachFile = async (file: File) => {
    setIsUploading(true);
    setUploadStatusText(`Extracting ${file.name}...`);
    try {
      let targetConvId = activeId;
      if (!targetConvId) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const newConv = chatService.createConversation(cleanName);
        targetConvId = newConv.id;
        setActiveId(targetConvId);
        onConversationsChange?.();
      }

      setUploadStatusText(`Indexing ${file.name} for study...`);
      const importRes = await documentService.importFile(file);
      if (!importRes.success && !importRes.document) {
        setErrorMsg(importRes.error || `Failed to process ${file.name}`);
        return;
      }

      const doc = importRes.document;
      if (doc) {
        chatService.attachDocument(targetConvId, doc.id);
        loadAttachedDocs(targetConvId);
        updateRAGStats();
      }
    } catch (err: any) {
      setErrorMsg('Document error: ' + (err.message || String(err)));
    } finally {
      setIsUploading(false);
      setUploadStatusText('');
    }
  };

  const handleDetachDocument = (docId: string) => {
    if (!activeId) return;
    chatService.detachDocument(activeId, docId);
    loadAttachedDocs(activeId);
    updateRAGStats();
  };

  const handleTriggerStudyAction = (action: StudyActionType) => {
    if (onNavigateToStudy) {
      const docId = attachedDocs.length > 0 ? attachedDocs[0].id : '';
      onNavigateToStudy(docId, action);
    } else {
      const actionPrompts: Record<StudyActionType, string> = {
        explain: attachedDocs.length > 0 
          ? `এই ${attachedDocs[0].filename} থেকে মূল বিষয়গুলো সহজ করে বাংলায় বুঝিয়ে দাও।`
          : 'Please explain the core concepts of our study topic in clear structured markdown.',
        summarize: attachedDocs.length > 0
          ? `এই ${attachedDocs[0].filename} ডকুমেন্টটির একটি পূর্ণাঙ্গ সামারি বা সারসংক্ষেপ তৈরি করে দাও।`
          : 'Please summarize our study topic with key takeaways.',
        notes: attachedDocs.length > 0
          ? `এই ${attachedDocs[0].filename} থেকে রিভিশন দেওয়ার মতো স্ট্রাকচার্ড স্টাডি নোট বানিয়ে দাও।`
          : 'Please generate structured study revision notes with key definitions.',
        quiz: attachedDocs.length > 0
          ? `এই ${attachedDocs[0].filename} থেকে ৫টি গুরুত্বপূর্ণ MCQ প্রশ্ন ও উত্তর তৈরি করো।`
          : 'Please create 5 high-yield multiple choice questions with explanations.',
        flashcards: attachedDocs.length > 0
          ? `এই ${attachedDocs[0].filename} থেকে রিভিশন ফ্ল্যাশকার্ড তৈরি করে দাও।`
          : 'Please create high-yield study flashcards for active recall.',
        plan: attachedDocs.length > 0
          ? `এই ${attachedDocs[0].filename} শেষ করার জন্য ৭ দিনের একটি কার্যকরী স্টাডি প্ল্যান তৈরি করো।`
          : 'Please create an offline study plan schedule.'
      };
      handleSendMessage(actionPrompts[action]);
    }
  };

  const handleClearCurrentConversation = () => {
    if (!activeId) return;
    if (window.confirm('Are you sure you want to clear all messages in this conversation?')) {
      chatService.clearConversation(activeId);
      setMessages([]);
      onConversationsChange?.();
    }
  };

  const handleDeleteMessage = (msgId: string) => {
    try {
      chatService.deleteMessage(msgId);
      if (activeId) {
        setMessages(chatService.getMessages(activeId));
      }
      onConversationsChange?.();
    } catch (err: any) {
      setErrorMsg('Failed to delete message: ' + err.message);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    flushStreamTokenBuffer();
    setStreamingContent('');
    setIsLoading(false);
    globalStatus.setAIStatus('Ready');
    if (activeId) {
      setMessages(chatService.getMessages(activeId));
    }
  };

  const handleRegenerate = async () => {
    if (!activeId || isLoading) return;
    setIsLoading(true);
    setStreamingContent('');
    setErrorMsg(null);
    abortControllerRef.current = new AbortController();
    globalStatus.setAIStatus('Generating');

    try {
      await chatService.regenerateLastAnswer(activeId, {
        signal: abortControllerRef.current.signal,
        useStudyMaterials,
        onToken: handleStreamToken
      });
      flushStreamTokenBuffer();
      setMessages(chatService.getMessages(activeId));
      globalStatus.setAIStatus('Ready');
      onConversationsChange?.();
    } catch (err: any) {
      flushStreamTokenBuffer();
      if (!err.message?.includes('cancelled')) {
        setErrorMsg('Regeneration Notice: ' + err.message);
        globalStatus.setAIStatus('Error');
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (text: string) => {
    let targetConvId = activeId;

    try {
      if (!targetConvId) {
        const newConv = chatService.createConversation(text.length > 25 ? text.substring(0, 25) + '...' : text);
        targetConvId = newConv.id;
        setActiveId(targetConvId);
        onConversationsChange?.();
      }

      // Optimistically show user message
      const tempUserMsg: ChatMessage = {
        id: 'temp_u_' + Date.now(),
        conversationId: targetConvId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setIsLoading(true);
      setStreamingContent('');
      setErrorMsg(null);
      globalStatus.setAIStatus('Generating');

      abortControllerRef.current = new AbortController();

      await chatService.sendMessage(targetConvId, text, {
        signal: abortControllerRef.current.signal,
        useStudyMaterials,
        onToken: handleStreamToken
      });

      flushStreamTokenBuffer();

      // Refresh messages
      setMessages(chatService.getMessages(targetConvId));
      globalStatus.setAIStatus('Ready');
      onConversationsChange?.();
    } catch (err: any) {
      flushStreamTokenBuffer();
      if (!err.message?.includes('cancelled')) {
        setErrorMsg('Inference Notice: ' + err.message);
        globalStatus.setAIStatus('Error');
      }
      if (targetConvId) {
        setMessages(chatService.getMessages(targetConvId));
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  const toggleStudyMaterials = () => {
    const next = !useStudyMaterials;
    setUseStudyMaterials(next);
    chatService.setStudyMaterialsEnabled(next);
    updateRAGStats();
  };

  return (
    <div className="chat-container">
      {/* Error Notification Banner */}
      {errorMsg && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          padding: '8px 16px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleRegenerate}
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid #ef4444',
                color: '#fef3c7',
                borderRadius: '4px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RotateCw size={11} />
              <span>Retry</span>
            </button>
            <button 
              onClick={() => setErrorMsg(null)}
              style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Clear Messages Action on Top Right if active conversation */}
      {messages.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '24px',
          zIndex: 5
        }}>
          <button
            onClick={handleClearCurrentConversation}
            title="Clear messages in this conversation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: '#a1a1aa',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* Main Messages Scroll Area */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        streamingContent={streamingContent}
        onSuggestionClick={handleSendMessage}
        onRegenerate={handleRegenerate}
        onRetry={handleRegenerate}
        onDeleteMessage={handleDeleteMessage}
        isModelInstalled={isModelInstalled}
        onOpenModelManager={onOpenModelManager}
      />

      {/* Fixed Bottom Input Composer */}
      <MessageComposer
        onSend={handleSendMessage}
        onStop={handleStopGeneration}
        disabled={isLoading}
        useStudyMaterials={useStudyMaterials}
        onToggleStudyMaterials={toggleStudyMaterials}
        indexedDocCount={indexedDocCount}
        attachedDocuments={attachedDocs}
        onAttachFile={handleAttachFile}
        onDetachDocument={handleDetachDocument}
        isUploading={isUploading}
        uploadStatusText={uploadStatusText}
        onTriggerStudyAction={handleTriggerStudyAction}
      />
    </div>
  );
}
