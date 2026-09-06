"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

import { deleteAssessment, generateAssessment, saveAssessment } from "@/app/assessments/actions";
import type { SavedAssessment } from "@/lib/assessments";
import type { CourseSummary, DocumentSummary } from "@/lib/materials";

type Props = {
  courses: CourseSummary[];
  documents: DocumentSummary[];
  assessments: SavedAssessment[];
};

type Notice = { tone: "error" | "success"; message: string } | null;

function cloneAssessment(value: SavedAssessment) {
  return structuredClone(value);
}

function citationLabel(citation: SavedAssessment["questions"][number]["citations"][number]) {
  return [citation.documentTitle, citation.pageNumber ? `Page ${citation.pageNumber}` : null, citation.heading]
    .filter(Boolean)
    .join(" · ");
}

const controlClass = "ui-control";

export function AssessmentsWorkspace({ courses, documents, assessments: initialAssessments }: Props) {
  const [items, setItems] = useState(initialAssessments);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState(() =>
    documents
      .filter((document) => document.courseId === courses[0]?.id && document.status === "ready")
      .map((document) => document.id),
  );
  const [type, setType] = useState<"multiple_choice_test" | "worksheet">("multiple_choice_test");
  const [topicFocus, setTopicFocus] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [level, setLevel] = useState<"Foundational" | "Standard" | "Challenge">("Standard");
  const [active, setActive] = useState<SavedAssessment | null>(
    items[0] ? cloneAssessment(items[0]) : null,
  );
  const [notice, setNotice] = useState<Notice>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const readyDocuments = documents.filter(
    (document) => document.courseId === courseId && document.status === "ready",
  );

  function chooseCourse(nextCourseId: string) {
    setCourseId(nextCourseId);
    setSelectedIds(
      documents
        .filter((document) => document.courseId === nextCourseId && document.status === "ready")
        .map((document) => document.id),
    );
  }

  function toggleDocument(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsGenerating(true);

    try {
      const result = await generateAssessment({
        courseId,
        documentIds: selectedIds,
        type,
        topicFocus,
        questionCount,
        level,
      });

      if ("error" in result) {
        setNotice({ tone: "error", message: result.error });
        return;
      }

      setItems((current) => [
        result.assessment,
        ...current.filter((item) => item.id !== result.assessment.id),
      ]);
      setActive(cloneAssessment(result.assessment));
      setNotice({
        tone: "success",
        message:
          result.generationMode === "mock"
            ? "Draft generated in local mock mode. Review every question before use."
            : "Draft generated. Review every question before use.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!active) return;
    setNotice(null);
    setIsSaving(true);

    try {
      const result = await saveAssessment({
        id: active.id,
        title: active.title,
        directions: active.directions,
        questions: active.questions.map(({ id, prompt, options, correctAnswer, explanation }) => ({
          id,
          prompt,
          options,
          correctAnswer,
          explanation,
        })),
      });

      if ("error" in result) {
        setNotice({ tone: "error", message: result.error });
        return;
      }

      setActive(cloneAssessment(result.assessment));
      setItems((current) => [
        result.assessment,
        ...current.filter((item) => item.id !== result.assessment.id),
      ]);
      setNotice({ tone: "success", message: "Assessment saved." });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!active || !window.confirm(`Delete “${active.title}”? This cannot be undone.`)) return;
    setNotice(null);
    setIsDeleting(true);

    try {
      const result = await deleteAssessment(active.id);
      if ("error" in result) {
        setNotice({ tone: "error", message: result.error });
        return;
      }
      setItems((current) => current.filter((item) => item.id !== active.id));
      setActive(null);
      setNotice({ tone: "success", message: "Assessment deleted." });
    } finally {
      setIsDeleting(false);
    }
  }

  function updateQuestion(
    index: number,
    key: "prompt" | "correctAnswer" | "explanation",
    value: string,
  ) {
    if (!active) return;
    setActive(
      (current) =>
        current && {
          ...current,
          questions: current.questions.map((question, questionIndex) =>
            questionIndex === index ? { ...question, [key]: value } : question,
          ),
        },
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    if (!active) return;
    setActive(
      (current) =>
        current && {
          ...current,
          questions: current.questions.map((question, index) =>
            index === questionIndex
              ? {
                  ...question,
                  options: question.options.map((option, item) =>
                    item === optionIndex ? value : option,
                  ),
                }
              : question,
          ),
        },
    );
  }

  return (
    <div className="paper-grid min-h-[calc(100vh-72px)]">
      <div className="page-container grid gap-8 py-16 lg:grid-cols-[20rem_minmax(0,1fr)] lg:py-24">
        <aside className="ui-card self-start overflow-hidden lg:sticky lg:top-6">
          <div className="border-b border-[var(--border)] bg-[#fbfbf9] p-5">
            <p className="ui-eyebrow">Assessment studio</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[var(--source-teal)]">Create an assessment</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Create an editable assessment from the sources selected for this course.</p>
          </div>

          <form className="space-y-6 p-6" onSubmit={handleGenerate}>
            <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
              Course
              <select className={controlClass} value={courseId} onChange={(event) => chooseCourse(event.target.value)}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-[var(--source-teal)]">Ready sources</legend>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Only selected sources will shape the draft.</p>
              <div className="mt-3 space-y-2">
                {readyDocuments.map((document) => (
                  <label className="flex gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm" key={document.id}>
                    <input
                      aria-label={document.title}
                      className="mt-0.5 size-4 accent-[var(--verified-green)]"
                      type="checkbox"
                      checked={selectedIds.includes(document.id)}
                      onChange={() => toggleDocument(document.id)}
                    />
                    {document.title}
                  </label>
                ))}
                {!readyDocuments.length ? (
                  <p className="rounded-[var(--radius)] bg-[#fff6df] px-3 py-2 text-sm leading-5 text-[#765a00]">Add and process a source before creating an assessment.</p>
                ) : null}
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
              Type
              <select className={controlClass} value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                <option value="multiple_choice_test">Multiple-choice test</option>
                <option value="worksheet">Worksheet</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
              Topic focus <span className="font-normal text-[var(--muted)]">(optional)</span>
              <input className={controlClass} value={topicFocus} maxLength={240} onChange={(event) => setTopicFocus(event.target.value)} placeholder="For example, cell structure" />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
                Questions
                <select className={controlClass} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}>
                  {[3, 5, 8, 10].map((count) => <option key={count} value={count}>{count}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
                Level
                <select className={controlClass} value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
                  {["Foundational", "Standard", "Challenge"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>

            <button
              className="ui-button-primary w-full"
              disabled={isGenerating || !courseId || selectedIds.length === 0}
              type="submit"
            >
              {isGenerating ? "Generating…" : "Generate editable draft"}
            </button>
          </form>

          <div className="border-t border-[var(--border)] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-[var(--source-teal)]">Saved assessments</h2>
              <span className="text-xs text-[var(--muted)]">{items.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {items.length ? (
                items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActive(cloneAssessment(item))}
                    className={`rounded-[var(--radius)] border px-4 py-3 text-left text-sm transition-colors ${active?.id === item.id ? "border-[var(--verified-green)]/40 bg-[#edf7f5] text-[var(--source-teal)]" : "border-[var(--border)] hover:bg-[#f7f7f5]"}`}
                  >
                    {item.title}
                  </button>
                ))
              ) : (
                <p className="text-sm leading-6 text-[var(--muted)]">Your saved drafts will appear here.</p>
              )}
            </div>
          </div>
        </aside>

        <section>
          {notice ? (
            <p className={`mb-4 rounded-[var(--radius)] border px-4 py-3 text-sm ${notice.tone === "error" ? "border-[var(--terracotta)]/30 bg-[#fff1ee] text-[#8c311e]" : "border-[var(--verified-green)]/30 bg-[#edf7f5] text-[#20766b]"}`}>
              {notice.message}
            </p>
          ) : null}

          {!active ? (
            <div className="grid min-h-[32rem] place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-white px-6 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#edf7f5] text-lg font-semibold text-[var(--verified-green)]">＋</span>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-[var(--source-teal)]">Create your first assessment</h2>
                <p className="mt-3 leading-7 text-[var(--muted)]">Create an editable assessment from the sources selected for this course.</p>
              </div>
            </div>
          ) : (
            <div className="ui-card">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-6 sm:px-8">
                <div>
                  <p className="ui-eyebrow">Editable · teacher-reviewed</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Citations stay tied to their supporting source passages.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="ui-button-secondary" target="_blank" href={`/assessments/${active.id}/print`}>Student copy</Link>
                  <Link className="ui-button-secondary" target="_blank" href={`/assessments/${active.id}/print?answerKey=1`}>Answer key</Link>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
                  Assessment title
                  <input className={`${controlClass} text-lg font-semibold`} value={active.title} onChange={(event) => setActive({ ...active, title: event.target.value })} />
                </label>
                <label className="mt-5 grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
                  Directions
                  <textarea className="ui-control min-h-24" value={active.directions} onChange={(event) => setActive({ ...active, directions: event.target.value })} />
                </label>

                <ol className="mt-8 grid gap-6">
                  {active.questions.map((question, index) => (
                    <li key={question.id} className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
                      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[#fbfbf9] px-4 py-3">
                        <p className="text-sm font-semibold text-[var(--source-teal)]">Question {index + 1}</p>
                        <span className="text-xs text-[var(--muted)]">{question.questionType === "multiple_choice" ? "Multiple choice" : "Short answer"}</span>
                      </div>
                      <div className="p-6">
                        <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
                          Prompt
                          <textarea className="ui-control min-h-20" value={question.prompt} onChange={(event) => updateQuestion(index, "prompt", event.target.value)} />
                        </label>

                        {question.questionType === "multiple_choice" ? (
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            {question.options.map((option, optionIndex) => (
                              <label className="grid gap-2 text-sm font-medium text-[var(--muted)]" key={optionIndex}>
                                Choice {"ABCD"[optionIndex]}
                                <input className={controlClass} value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} />
                              </label>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
                            Answer key
                            <textarea className="ui-control min-h-24" value={question.correctAnswer} onChange={(event) => updateQuestion(index, "correctAnswer", event.target.value)} />
                          </label>
                          <label className="grid gap-2 text-sm font-semibold text-[var(--source-teal)]">
                            Explanation
                            <textarea className="ui-control min-h-24" value={question.explanation} onChange={(event) => updateQuestion(index, "explanation", event.target.value)} />
                          </label>
                        </div>

                        <div className="mt-5 border-l-2 border-[var(--verified-green)] bg-[#f3f8f7] p-4 text-sm">
                          <p className="text-xs font-bold tracking-[0.12em] text-[var(--verified-green)] uppercase">Supporting sources</p>
                          {question.citations.map((citation) => (
                            <div className="mt-3" key={citation.sourceChunkId}>
                              <p className="font-semibold text-[var(--source-teal)]">{citationLabel(citation)}</p>
                              <p className="source-quote mt-1 leading-6 text-[#3d3d39]">{citation.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-6">
                  <button onClick={handleSave} disabled={isSaving || isDeleting} className="ui-button-primary">{isSaving ? "Saving…" : "Save changes"}</button>
                  <button onClick={handleDelete} disabled={isSaving || isDeleting} className="ui-button-danger">{isDeleting ? "Deleting…" : "Delete assessment"}</button>
                  <p className="text-sm text-[var(--muted)] sm:ml-auto">Review every detail before use.</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
