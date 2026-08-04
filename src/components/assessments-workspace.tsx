"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

import { deleteAssessment, generateAssessment, saveAssessment } from "@/app/assessments/actions";
import type { SavedAssessment } from "@/lib/assessments";
import type { CourseSummary, DocumentSummary } from "@/lib/materials";

type Props = { courses: CourseSummary[]; documents: DocumentSummary[]; assessments: SavedAssessment[] };
type Notice = { tone: "error" | "success"; message: string } | null;

function cloneAssessment(value: SavedAssessment) {
  return structuredClone(value);
}

function citationLabel(citation: SavedAssessment["questions"][number]["citations"][number]) {
  return [citation.documentTitle, citation.pageNumber ? `Page ${citation.pageNumber}` : null, citation.heading]
    .filter(Boolean)
    .join(" · ");
}

export function AssessmentsWorkspace({ courses, documents, assessments: initialAssessments }: Props) {
  const [items, setItems] = useState(initialAssessments);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState(() =>
    documents.filter((document) => document.courseId === courses[0]?.id && document.status === "ready").map((document) => document.id),
  );
  const [type, setType] = useState<"multiple_choice_test" | "worksheet">("multiple_choice_test");
  const [topicFocus, setTopicFocus] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [level, setLevel] = useState<"Foundational" | "Standard" | "Challenge">("Standard");
  const [active, setActive] = useState<SavedAssessment | null>(items[0] ? cloneAssessment(items[0]) : null);
  const [notice, setNotice] = useState<Notice>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const readyDocuments = documents.filter((document) => document.courseId === courseId && document.status === "ready");

  function chooseCourse(nextCourseId: string) {
    setCourseId(nextCourseId);
    setSelectedIds(documents.filter((document) => document.courseId === nextCourseId && document.status === "ready").map((document) => document.id));
  }

  function toggleDocument(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsGenerating(true);
    try {
      const result = await generateAssessment({ courseId, documentIds: selectedIds, type, topicFocus, questionCount, level });
      if ("error" in result) { setNotice({ tone: "error", message: result.error }); return; }
      setItems((current) => [result.assessment, ...current.filter((item) => item.id !== result.assessment.id)]);
      setActive(cloneAssessment(result.assessment));
      setNotice({ tone: "success", message: result.generationMode === "mock" ? "Draft generated in local mock mode. Review every question before use." : "Draft generated. Review every question before use." });
    } finally { setIsGenerating(false); }
  }

  async function handleSave() {
    if (!active) return;
    setNotice(null); setIsSaving(true);
    try {
      const result = await saveAssessment({ id: active.id, title: active.title, directions: active.directions, questions: active.questions.map(({ id, prompt, options, correctAnswer, explanation }) => ({ id, prompt, options, correctAnswer, explanation })) });
      if ("error" in result) { setNotice({ tone: "error", message: result.error }); return; }
      setActive(cloneAssessment(result.assessment));
      setItems((current) => [result.assessment, ...current.filter((item) => item.id !== result.assessment.id)]);
      setNotice({ tone: "success", message: "Assessment saved." });
    } finally { setIsSaving(false); }
  }

  async function handleDelete() {
    if (!active || !window.confirm(`Delete “${active.title}”? This cannot be undone.`)) return;
    setNotice(null); setIsDeleting(true);
    try {
      const result = await deleteAssessment(active.id);
      if ("error" in result) { setNotice({ tone: "error", message: result.error }); return; }
      setItems((current) => current.filter((item) => item.id !== active.id));
      setActive(null);
      setNotice({ tone: "success", message: "Assessment deleted." });
    } finally { setIsDeleting(false); }
  }

  function updateQuestion(index: number, key: "prompt" | "correctAnswer" | "explanation", value: string) {
    if (!active) return;
    setActive((current) => current && ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, [key]: value } : question) }));
  }
  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    if (!active) return;
    setActive((current) => current && ({ ...current, questions: current.questions.map((question, index) => index === questionIndex ? { ...question, options: question.options.map((option, item) => item === optionIndex ? value : option) } : question) }));
  }

  return <div className="min-h-screen bg-[#f7f7f5] text-[#191919]"><div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:px-12">
    <aside className="self-start rounded-xl border border-black/15 bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.05)] lg:sticky lg:top-6">
      <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">Assessment studio</p><h1 className="mt-2 text-2xl font-semibold">Create an assessment</h1>
      <form className="mt-5 space-y-4" onSubmit={handleGenerate}>
        <label className="grid gap-1 text-sm font-semibold">Course<select className="h-10 rounded border border-black/20 px-2 font-normal" value={courseId} onChange={(event) => chooseCourse(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <fieldset><legend className="text-sm font-semibold">Ready materials</legend><div className="mt-2 space-y-2">{readyDocuments.map((document) => <label key={document.id} className="flex gap-2 text-sm"><input aria-label={document.title} type="checkbox" checked={selectedIds.includes(document.id)} onChange={() => toggleDocument(document.id)} />{document.title}</label>)}</div></fieldset>
        <label className="grid gap-1 text-sm font-semibold">Type<select className="h-10 rounded border border-black/20 px-2 font-normal" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="multiple_choice_test">Multiple-choice test</option><option value="worksheet">Worksheet</option></select></label>
        <label className="grid gap-1 text-sm font-semibold">Topic focus <span className="font-normal text-[#6b6b67]">(optional)</span><input className="h-10 rounded border border-black/20 px-2 font-normal" value={topicFocus} maxLength={240} onChange={(event) => setTopicFocus(event.target.value)} placeholder="For example, cell structure" /></label>
        <label className="grid gap-1 text-sm font-semibold">Questions<select className="h-10 rounded border border-black/20 px-2 font-normal" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}>{[3,5,8,10].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Level<select className="h-10 rounded border border-black/20 px-2 font-normal" value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>{["Foundational","Standard","Challenge"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="w-full rounded bg-[#264653] px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isGenerating || !courseId || selectedIds.length === 0} type="submit">{isGenerating ? "Generating…" : "Generate draft"}</button>
      </form>
      <div className="mt-7 border-t border-black/10 pt-5"><h2 className="font-semibold">Saved assessments</h2><div className="mt-2 grid gap-2">{items.length ? items.map((item) => <button key={item.id} onClick={() => setActive(cloneAssessment(item))} className="rounded border border-black/15 px-3 py-2 text-left text-sm hover:bg-[#f0f6f5]">{item.title}</button>) : <p className="text-sm text-[#6b6b67]">Your saved drafts will appear here.</p>}</div></div>
    </aside>
    <section>{notice ? <p className={`rounded px-3 py-2 text-sm ${notice.tone === "error" ? "bg-[#fbe9e5] text-[#8c311e]" : "bg-[#e6f4ee] text-[#1f6b51]"}`}>{notice.message}</p> : null}
      {!active ? <div className="rounded-xl border border-dashed border-black/20 bg-white px-6 py-16 text-center text-[#565650]">Choose ready material and generate your first editable draft.</div> : <div className="rounded-xl border border-black/15 bg-white p-6 shadow-[0_12px_34px_rgba(0,0,0,0.05)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">Editable draft</p><p className="mt-1 text-sm text-[#565650]">Citations remain tied to their real source passages.</p></div><div className="flex gap-2"><Link className="rounded border border-black/25 px-3 py-2 text-sm font-semibold" target="_blank" href={`/assessments/${active.id}/print`}>Print student copy</Link><Link className="rounded border border-[#264653]/35 px-3 py-2 text-sm font-semibold text-[#264653]" target="_blank" href={`/assessments/${active.id}/print?answerKey=1`}>Print answer key</Link></div></div>
        <label className="mt-6 grid gap-1 text-sm font-semibold">Title<input className="h-11 rounded border border-black/20 px-3 text-lg font-semibold" value={active.title} onChange={(event) => setActive({ ...active, title: event.target.value })} /></label>
        <label className="mt-4 grid gap-1 text-sm font-semibold">Directions<textarea className="min-h-20 rounded border border-black/20 p-3 font-normal" value={active.directions} onChange={(event) => setActive({ ...active, directions: event.target.value })} /></label>
        <ol className="mt-7 grid gap-5">{active.questions.map((question, index) => <li key={question.id} className="rounded-lg border border-black/15 p-4"><p className="text-sm font-semibold text-[#264653]">Question {index + 1} · {question.questionType === "multiple_choice" ? "Multiple choice" : "Short answer"}</p><label className="mt-3 grid gap-1 text-sm font-semibold">Prompt<textarea className="min-h-20 rounded border border-black/20 p-2 font-normal" value={question.prompt} onChange={(event) => updateQuestion(index,"prompt",event.target.value)} /></label>{question.questionType === "multiple_choice" ? <div className="mt-3 grid gap-2">{question.options.map((option, optionIndex) => <label key={optionIndex} className="grid gap-1 text-sm">Choice {"ABCD"[optionIndex]}<input className="h-10 rounded border border-black/20 px-2" value={option} onChange={(event) => updateOption(index,optionIndex,event.target.value)} /></label>)}</div> : null}<label className="mt-3 grid gap-1 text-sm font-semibold">Answer key<textarea className="min-h-16 rounded border border-black/20 p-2 font-normal" value={question.correctAnswer} onChange={(event) => updateQuestion(index,"correctAnswer",event.target.value)} /></label><label className="mt-3 grid gap-1 text-sm font-semibold">Explanation<textarea className="min-h-16 rounded border border-black/20 p-2 font-normal" value={question.explanation} onChange={(event) => updateQuestion(index,"explanation",event.target.value)} /></label><div className="mt-3 rounded bg-[#f0f6f5] p-3 text-sm"><p className="font-semibold text-[#264653]">Sources</p>{question.citations.map((citation) => <p key={citation.sourceChunkId} className="mt-1 leading-5"><span className="font-medium">{citationLabel(citation)}</span> — {citation.excerpt}</p>)}</div></li>)}</ol>
        <div className="mt-7 flex flex-wrap gap-3"><button onClick={handleSave} disabled={isSaving || isDeleting} className="rounded bg-[#264653] px-5 py-3 font-semibold text-white disabled:opacity-60">{isSaving ? "Saving…" : "Save changes"}</button><button onClick={handleDelete} disabled={isSaving || isDeleting} className="rounded border border-[#b94c35]/35 px-5 py-3 font-semibold text-[#9a3926] disabled:opacity-60">{isDeleting ? "Deleting…" : "Delete assessment"}</button></div>
      </div>}</section>
  </div></div>;
}
