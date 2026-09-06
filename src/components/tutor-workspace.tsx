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
    <div className="paper-grid min-h-[calc(100vh-4rem)]">
      <div className="mx-auto grid max-w-7xl gap-7 px-5 py-10 sm:px-8 lg:grid-cols-[19.5rem_minmax(0,1fr)] lg:px-12 lg:py-12">
        <aside className="self-start overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_12px_34px_rgba(38,70,83,0.06)] lg:sticky lg:top-6">
          <div className="bg-[var(--source-teal)] p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-[#a9d9d2] uppercase">Study Tutor</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Study with guidance</h1>
              </div>
              <button className="border border-white/35 px-3 py-1.5 text-sm font-semibold transition hover:bg-white hover:text-[var(--source-teal)]" onClick={startNewConversation} type="button">New</button>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/75">Choose the exact sources this conversation can use. The tutor guides before revealing a full explanation.</p>
          </div>

          <div className="grid gap-5 p-5">
            <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
              Course
              <select
                aria-label="Course"
                className="h-11 border border-[var(--border)] bg-white px-3 text-base font-normal outline-none focus:border-[var(--source-teal)] disabled:bg-[#f3f3f0]"
                disabled={lockedScope || isSending}
                value={courseId}
                onChange={(event) => chooseCourse(event.target.value)}
              >
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-[var(--source-teal)]">Sources for this conversation</legend>
              {lockedScope ? <p className="mt-1 text-xs leading-5 text-[var(--muted)]">This source scope is locked for privacy. Start a new conversation to change it.</p> : <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Only selected sources can support this conversation.</p>}
              <div className="mt-3 grid gap-2">
                {readyDocuments.map((document) => (
                  <label key={document.id} className="flex gap-2.5 rounded-md border border-[var(--border)] bg-[#fbfbf9] px-3 py-2.5 text-sm">
                    <input
                      aria-label={document.title}
                      className="mt-0.5 size-4 accent-[var(--verified-green)]"
                      type="checkbox"
                      checked={selectedDocumentIds.includes(document.id)}
                      disabled={lockedScope || isSending}
                      onChange={() => toggleDocument(document.id)}
                    />
                    {document.title}
                  </label>
                ))}
              </div>
              {!readyDocuments.length ? <p className="mt-2 rounded-md bg-[#fff1ee] px-3 py-2 text-sm leading-5 text-[#8c311e]">This course needs at least one ready source.</p> : null}
            </fieldset>
          </div>

          <div className="border-t border-[var(--border)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--source-teal)]">Saved conversations</h2>
              <span className="text-xs text-[var(--muted)]">{items.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {items.length ? items.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  disabled={isSending}
                  onClick={() => selectConversation(conversation)}
                  className={`border px-3 py-2.5 text-left text-sm transition ${activeId === conversation.id ? "border-[var(--verified-green)]/40 bg-[#edf7f5] font-medium text-[var(--source-teal)]" : "border-[var(--border)] hover:bg-[#f7f7f5]"}`}
                >
                  {conversation.title}
                </button>
              )) : <p className="text-sm leading-6 text-[var(--muted)]">Your tutor conversations will be saved here.</p>}
            </div>
          </div>
        </aside>

        <section className="flex min-h-[46rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_16px_45px_rgba(38,70,83,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[#fbfbf9] px-5 py-4 sm:px-6">
            <div>
              <p className="text-base font-semibold text-[var(--source-teal)]">{active ? active.title : "New study conversation"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Citation-backed guidance uses only the sources selected here.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--verified-green)]/25 bg-[#edf7f5] px-3 py-1 text-xs font-semibold text-[#20766b]">
              <span className="size-1.5 rounded-full bg-[var(--verified-green)]" />
              Source scope visible
            </span>
          </div>

          {notice ? <p className={`mx-5 mt-5 border px-4 py-3 text-sm sm:mx-6 ${notice.tone === "error" ? "border-[var(--terracotta)]/30 bg-[#fff1ee] text-[#8c311e]" : "border-[var(--verified-green)]/30 bg-[#edf7f5] text-[#20766b]"}`}>{notice.message}</p> : null}

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
            {!active ? (
              <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-[var(--border)] bg-[#fbfbf9] px-5 text-center">
                <div className="max-w-md">
                  <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#edf7f5] text-lg font-semibold text-[var(--verified-green)]">?</span>
                  <h2 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-[var(--source-teal)]">Ask from the source</h2>
                  <p className="mt-3 leading-7 text-[var(--muted)]">Ask about your course and receive guidance backed by your selected sources.</p>
                </div>
              </div>
            ) : null}

            {active?.messages.map((message) => (
              <article
                key={message.id}
                className={message.role === "user" ? "ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-[var(--source-teal)] px-4 py-3 text-white" : "max-w-[94%] border-l-2 border-[var(--verified-green)] bg-[#f8faf9] px-4 py-4 text-[var(--foreground)]"}
              >
                {message.role === "assistant" ? <p className="mb-2 text-xs font-bold tracking-[0.12em] text-[var(--verified-green)] uppercase">Study Tutor</p> : null}
                <p className="whitespace-pre-wrap text-base leading-7">{message.content || (message.role === "assistant" ? "Thinking…" : "")}</p>
                {message.role === "assistant" && message.citations.length === 0 ? <p className="mt-4 border border-[var(--study-gold)]/45 bg-[#fff6df] px-3 py-2 text-xs font-semibold leading-5 text-[#765a00]">General knowledge — no selected source supports this response.</p> : null}
                {message.citations.length ? (
                  <div className="mt-4 grid gap-3">
                    {message.citations.map((citation, index) => (
                      <div key={citation.sourceChunkId} className="border border-[var(--verified-green)]/25 bg-white px-3.5 py-3 text-sm leading-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[var(--source-teal)]">{citationLabel(citation)}</p>
                          <span className="text-[0.68rem] font-bold tracking-[0.1em] text-[var(--verified-green)] uppercase">Citation {String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <p className="source-quote mt-2 text-[#3d3d39]">{citation.excerpt}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}

            {generationMode === "mock" ? <p className="border border-[var(--study-gold)]/45 bg-[#fff6df] px-3 py-2 text-xs leading-5 text-[#765a00]">Development mode: this is a deterministic guidance-first tutor response.</p> : null}
          </div>

          <form className="border-t border-[var(--border)] bg-[#fbfbf9] p-4 sm:p-5" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="tutor-question">Your question</label>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <textarea
                id="tutor-question"
                aria-label="Your question"
                className="min-h-24 flex-1 border border-[var(--border)] bg-white p-3 text-base leading-6 outline-none focus:border-[var(--source-teal)]"
                disabled={isSending || !courseId || !selectedDocumentIds.length}
                maxLength={2000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about the selected sources or share your reasoning…"
              />
              <button className="bg-[var(--source-teal)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--source-teal-dark)] disabled:opacity-60" disabled={!canSend} type="submit">{isSending ? "Thinking…" : "Ask tutor"}</button>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">StudySourced AI may make mistakes. Check the cited passage and build your own understanding.</p>
          </form>
        </section>
      </div>
    </div>
  );
}
