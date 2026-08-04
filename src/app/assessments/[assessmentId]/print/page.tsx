import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { parseSavedAssessment } from "@/lib/assessments";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { choiceLabel } from "@/lib/assessment-print";

export default async function PrintAssessmentPage({ params, searchParams }: { params: Promise<{ assessmentId: string }>; searchParams: Promise<{ answerKey?: string }> }) {
  const { assessmentId } = await params;
  const { answerKey } = await searchParams;
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/sign-in");
  const { data } = await supabase.from("generated_materials").select("id, course_id, type, title, directions, generation_settings, created_at, updated_at, material_questions(id, question_index, prompt, question_type, options, correct_answer, explanation, citations)").eq("id", assessmentId).maybeSingle();
  if (!data) notFound();
  let assessment; try { assessment = parseSavedAssessment(data); } catch { notFound(); }
  const showKey = answerKey === "1";
  return <main className="mx-auto max-w-3xl bg-white px-8 py-10 text-[#191919] print:max-w-none print:px-0 print:py-0"><div className="mb-8 flex items-center justify-between print:hidden"><Link className="text-sm font-semibold text-[#264653]" href="/assessments">← Back to assessments</Link><PrintButton /></div><header className="border-b-2 border-black pb-5"><p className="text-sm font-semibold tracking-[0.14em] uppercase">{showKey ? "Answer key" : assessment.type === "worksheet" ? "Worksheet" : "Multiple-choice test"}</p><h1 className="mt-2 text-3xl font-bold">{assessment.title}</h1><p className="mt-3 leading-6">{assessment.directions}</p>{!showKey ? <div className="mt-8 flex justify-between text-sm"><span>Name: __________________________</span><span>Date: ______________</span></div> : null}</header><ol className="mt-8 space-y-7">{assessment.questions.map((question, index) => <li key={question.id}><p className="font-semibold">{index + 1}. {question.prompt}</p>{question.questionType === "multiple_choice" ? <ol className="mt-3 grid gap-2">{question.options.map((option, optionIndex) => <li key={option} className="flex"><span className="inline-block w-8 shrink-0 font-semibold">{choiceLabel(optionIndex)}</span><span>{option}</span></li>)}</ol> : <div className="mt-4 h-24 border-b border-black" />}{showKey ? <div className="mt-4 rounded border border-black/20 bg-[#f7f7f5] p-3 text-sm"><p><strong>Answer:</strong> {question.questionType === "multiple_choice" ? `${choiceLabel(question.options.indexOf(question.correctAnswer))} ` : ""}{question.correctAnswer}</p><p className="mt-2"><strong>Explanation:</strong> {question.explanation}</p>{question.citations.map((citation) => <p key={citation.sourceChunkId} className="mt-2"><strong>Source:</strong> {[citation.documentTitle, citation.pageNumber ? `Page ${citation.pageNumber}` : null, citation.heading].filter(Boolean).join(" · ")} — {citation.excerpt}</p>)}</div> : null}</li>)}</ol></main>;
}
