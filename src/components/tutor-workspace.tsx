"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";

import type { CourseSummary, DocumentSummary } from "@/lib/materials";
import type { TutorCitation } from "@/lib/tutor-generation";
import type { TutorConversation, TutorMessage } from "@/lib/tutor";
import type { TutorStreamEvent } from "@/lib/tutor-stream";

type Props = {
  courses: CourseSummary[];
  documents: DocumentSummary[];
  conversations: TutorConversation[];
};

type Notice = { tone: "error" | "success"; message: string } | null;

function readyDocumentIds(documents: DocumentSummary[], courseId: string) {
  return documents
    .filter((document) => document.courseId === courseId && document.status === "ready")
    .map((document) => document.id);
}

function citationLabel(citation: TutorCitation) {
  return [
    citation.documentTitle,
    citation.pageNumber === null ? null : `Page ${citation.pageNumber}`,
    citation.heading,
  ]
    .filter(Boolean)
    .join(" · ");
}

function clientMessage(role: TutorMessage["role"], content: string): TutorMessage {
  return {
    id: `local-${Date.now()}-${Math.random()}`,
    role,
    content,
    citations: [],
    createdAt: new Date().toISOString(),
  };
}

export function TutorWorkspace({ courses, documents, conversations: initialConversations }: Props) {
  const [items, setItems] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [courseId, setCourseId] = useState(initialConversations[0]?.courseId ?? courses[0]?.id ?? "");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(
    initialConversations[0]?.sourceDocumentIds ?? readyDocumentIds(documents, courses[0]?.id ?? ""),
  );
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isSending, setIsSending] = useState(false);
  const [generationMode, setGenerationMode] = useState<"mock" | "openai" | null>(null);
  const streamingConversationId = useRef<string | null>(null);

  const active = useMemo(() => items.find((item) => item.id === activeId) ?? null, [activeId, items]);
  const readyDocuments = documents.filter(
    (document) => document.courseId === courseId && document.status === "ready",
  );
  const lockedScope = Boolean(active);
  const canSend = Boolean(courseId && selectedDocumentIds.length && question.trim() && !isSending);

  function chooseCourse(nextCourseId: string) {
    if (lockedScope) return;
    setCourseId(nextCourseId);
    setSelectedDocumentIds(readyDocumentIds(documents, nextCourseId));
  }

  function toggleDocument(documentId: string) {
    if (lockedScope) return;
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  }

  function startNewConversation() {
    if (isSending) return;
    setActiveId(null);
    streamingConversationId.current = null;
    setCourseId(courses[0]?.id ?? "");
    setSelectedDocumentIds(readyDocumentIds(documents, courses[0]?.id ?? ""));
    setQuestion("");
    setGenerationMode(null);
    setNotice(null);
  }

  function selectConversation(conversation: TutorConversation) {
    if (isSending) return;
    setActiveId(conversation.id);
    streamingConversationId.current = conversation.id;
    setCourseId(conversation.courseId ?? "");
    setSelectedDocumentIds(conversation.sourceDocumentIds);
    setQuestion("");
    setGenerationMode(null);
    setNotice(null);
  }

  function appendToConversation(conversationId: string, message: TutorMessage) {
    setItems((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, updatedAt: message.createdAt, messages: [...conversation.messages, message] }
          : conversation,
      ),
    );
  }

  async function handleEvent(event: TutorStreamEvent, userMessage: TutorMessage) {
    if (event.type === "conversation") {
      setActiveId(event.conversation.id);
      streamingConversationId.current = event.conversation.id;
      setCourseId(event.conversation.courseId);
      setSelectedDocumentIds(event.conversation.sourceDocumentIds);
      setItems((current) => {
        const existing = current.find((item) => item.id === event.conversation.id);
        const next: TutorConversation = {
          id: event.conversation.id,
          courseId: event.conversation.courseId,
          title: event.conversation.title,
          topicFocus: null,
          sourceDocumentIds: event.conversation.sourceDocumentIds,
          createdAt: event.conversation.createdAt,
          updatedAt: event.conversation.updatedAt,
          messages: existing?.messages ?? [userMessage],
        };
        return [next, ...current.filter((item) => item.id !== next.id)];
      });
      return;
    }
    if (event.type === "assistant") {
      const conversationId = streamingConversationId.current;
      // The conversation event is always emitted first. This fallback only prevents a broken stream from crashing the UI.
      if (!conversationId) return;
      setGenerationMode(event.generationMode ?? null);
      appendToConversation(conversationId, {
        id: event.messageId,
        role: "assistant",
        content: "",
        citations: event.citations,
        createdAt: event.createdAt,
      });
      return;
    }
    if (event.type === "delta") {
      const conversationId = streamingConversationId.current;
      if (!conversationId) return;
      setItems((current) => {
        const conversation = current.find((item) => item.id === conversationId);
        const assistant = conversation?.messages.at(-1);
        return assistant?.role === "assistant"
          ? current.map((item) =>
              item.id === conversationId
                ? {
                    ...item,
                    messages: item.messages.map((message) =>
                      message.id === assistant.id
                        ? { ...message, content: `${message.content}${event.value}` }
                        : message,
                    ),
                  }
                : item,
            )
          : current;
      });
      return;
    }
    if (event.type === "error") setNotice({ tone: "error", message: event.message });
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!canSend) return;
    const message = question.trim();
    const userMessage = clientMessage("user", message);
    const conversationId = active?.id ?? null;
    streamingConversationId.current = conversationId;
    setNotice(null);
    setQuestion("");
    setIsSending(true);
    if (conversationId) appendToConversation(conversationId, userMessage);

    try {
      const response = await fetch("/api/tutor/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, courseId, documentIds: selectedDocumentIds, message }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(typeof payload?.error === "string" ? payload.error : "The tutor could not respond. Please try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          await handleEvent(JSON.parse(line) as TutorStreamEvent, userMessage);
        }
      }
      if (buffer.trim()) await handleEvent(JSON.parse(buffer) as TutorStreamEvent, userMessage);
    } catch (error) {
      if (conversationId) {
        setItems((current) =>
          current.map((item) =>
            item.id === conversationId
              ? { ...item, messages: item.messages.filter((itemMessage) => itemMessage.id !== userMessage.id) }
              : item,
          ),
        );
      }
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "The tutor could not respond. Please try again." });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-7 px-6 py-10 lg:grid-cols-[19rem_minmax(0,1fr)] lg:px-12">
      <aside className="self-start rounded-xl border border-black/15 bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.05)] lg:sticky lg:top-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">AI tutor</p>
            <h1 className="mt-1 text-xl font-semibold">Study with guidance</h1>
          </div>
          <button className="rounded border border-[#264653]/30 px-2.5 py-1.5 text-sm font-semibold text-[#264653]" onClick={startNewConversation} type="button">New</button>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#565650]">Choose the exact material this conversation can use. The tutor guides before revealing a full explanation.</p>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">Course
            <select aria-label="Course" className="h-10 rounded border border-black/20 bg-white px-2 font-normal disabled:bg-[#f3f3f0]" disabled={lockedScope || isSending} value={courseId} onChange={(event) => chooseCourse(event.target.value)}>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">Materials for this conversation</legend>
            {lockedScope ? <p className="mt-1 text-xs leading-5 text-[#6b6b67]">This scope is locked for privacy. Start a new conversation to use different material.</p> : null}
            <div className="mt-2 grid gap-2">
              {readyDocuments.map((document) => <label key={document.id} className="flex gap-2 rounded border border-black/10 bg-[#f7f7f5] px-2.5 py-2 text-sm"><input aria-label={document.title} type="checkbox" checked={selectedDocumentIds.includes(document.id)} disabled={lockedScope || isSending} onChange={() => toggleDocument(document.id)} />{document.title}</label>)}
            </div>
            {!readyDocuments.length ? <p className="mt-2 text-sm text-[#8c311e]">This course needs at least one ready material.</p> : null}
          </fieldset>
        </div>

        <div className="mt-7 border-t border-black/10 pt-5"><h2 className="text-sm font-semibold">Saved conversations</h2><div className="mt-2 grid gap-2">{items.length ? items.map((conversation) => <button key={conversation.id} type="button" disabled={isSending} onClick={() => selectConversation(conversation)} className={`rounded border px-3 py-2 text-left text-sm ${activeId === conversation.id ? "border-[#264653]/35 bg-[#f0f6f5]" : "border-black/15 hover:bg-[#f7f7f5]"}`}>{conversation.title}</button>) : <p className="text-sm text-[#6b6b67]">Your conversations will be saved here.</p>}</div></div>
      </aside>

      <section className="flex min-h-[42rem] flex-col overflow-hidden rounded-xl border border-black/15 bg-white shadow-[0_12px_34px_rgba(0,0,0,0.05)]">
        <div className="border-b border-black/10 px-6 py-5"><p className="text-sm font-semibold text-[#264653]">{active ? active.title : "New conversation"}</p><p className="mt-1 text-sm text-[#565650]">Cited responses use only the material selected for this conversation.</p></div>
        {notice ? <p className={`mx-6 mt-5 rounded px-3 py-2 text-sm ${notice.tone === "error" ? "bg-[#fbe9e5] text-[#8c311e]" : "bg-[#e6f4ee] text-[#1f6b51]"}`}>{notice.message}</p> : null}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {!active ? <div className="rounded-lg border border-dashed border-black/20 bg-[#f7f7f5] px-5 py-10 text-center text-sm leading-6 text-[#565650]">Ask a question to start a private, cited study conversation. The first response will prompt you to think before it explains.</div> : null}
          {active?.messages.map((message) => <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-xl bg-[#264653] px-4 py-3 text-white" : "max-w-[92%] rounded-xl bg-[#f0f6f5] px-4 py-3 text-[#191919]"}>
            <p className="whitespace-pre-wrap text-sm leading-6">{message.content || (message.role === "assistant" ? "Thinking…" : "")}</p>
            {message.role === "assistant" && message.citations.length === 0 ? <p className="mt-3 rounded bg-[#fff3cf] px-2.5 py-2 text-xs font-semibold leading-5 text-[#765a00]">General knowledge — no selected source supports this response.</p> : null}
            {message.citations.length ? <div className="mt-3 grid gap-2">{message.citations.map((citation) => <div key={citation.sourceChunkId} className="rounded border border-[#264653]/20 bg-white px-3 py-2 text-xs leading-5"><p className="font-semibold text-[#264653]">{citationLabel(citation)}</p><p className="mt-1 text-[#30302d]">{citation.excerpt}</p></div>)}</div> : null}
          </article>)}
          {generationMode === "mock" ? <p className="rounded bg-[#fff3cf] px-3 py-2 text-xs leading-5 text-[#765a00]">Development mode: this is a deterministic guidance-first tutor response.</p> : null}
        </div>
        <form className="border-t border-black/10 p-4 sm:p-5" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="tutor-question">Your question</label>
          <div className="flex items-end gap-3"><textarea id="tutor-question" aria-label="Your question" className="min-h-20 flex-1 rounded-lg border border-black/20 p-3 text-sm leading-5 outline-none focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/20" disabled={isSending || !courseId || !selectedDocumentIds.length} maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the selected material or share your reasoning…" /><button className="rounded bg-[#264653] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={!canSend} type="submit">{isSending ? "Thinking…" : "Send"}</button></div>
        </form>
      </section>
    </div>
  );
}
