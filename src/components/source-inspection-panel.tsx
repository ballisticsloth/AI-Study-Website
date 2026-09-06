"use client";

import { type FormEvent, useState } from "react";

import {
  searchSourcePassages,
  type SourcePassage,
} from "@/app/materials/retrieval-actions";
import {
  type CourseSummary,
  type DocumentSummary,
} from "@/lib/materials";

type SourceInspectionPanelProps = {
  courses: CourseSummary[];
  documents: DocumentSummary[];
};

type SearchState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "results"; passages: SourcePassage[]; isMock: boolean };

function readyDocumentIdsForCourse(documents: DocumentSummary[], courseId: string) {
  return documents
    .filter((document) => document.courseId === courseId && document.status === "ready")
    .map((document) => document.id);
}

function formatCitation(passage: SourcePassage) {
  const location = [
    passage.documentTitle,
    passage.pageNumber === null ? null : `Page ${passage.pageNumber}`,
    passage.heading,
  ].filter((part): part is string => Boolean(part));

  return location.join(" · ");
}

export function SourceInspectionPanel({ courses, documents }: SourceInspectionPanelProps) {
  const firstCourseId = courses[0]?.id ?? "";
  const [courseId, setCourseId] = useState(firstCourseId);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(() =>
    readyDocumentIdsForCourse(documents, firstCourseId),
  );
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ kind: "idle" });

  const readyDocuments = documents.filter(
    (document) => document.courseId === courseId && document.status === "ready",
  );
  const canSearch = Boolean(courseId && readyDocuments.length > 0 && !isSearching);

  function chooseCourse(nextCourseId: string) {
    setCourseId(nextCourseId);
    setSelectedDocumentIds(readyDocumentIdsForCourse(documents, nextCourseId));
    setSearchState({ kind: "idle" });
  }

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((currentIds) =>
      currentIds.includes(documentId)
        ? currentIds.filter((id) => id !== documentId)
        : [...currentIds, documentId],
    );
    setSearchState({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSearch) {
      return;
    }

    setIsSearching(true);
    setSearchState({ kind: "idle" });

    try {
      const result = await searchSourcePassages({
        courseId,
        documentIds: selectedDocumentIds,
        query,
      });

      if ("error" in result) {
        setSearchState({ kind: "error", message: result.error });
        return;
      }

      setSearchState({
        kind: "results",
        passages: result.passages,
        isMock: result.embeddingMode === "mock",
      });
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_34px_rgba(38,70,83,0.05)] sm:p-7">
      <p className="text-xs font-bold tracking-[0.14em] text-[var(--verified-green)] uppercase">
        Source inspector
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[var(--source-teal)]">Check the passages your study tools can cite</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Search your prepared sources to preview the compact, cited excerpts that assessments and tutoring can use.
      </p>

      {courses.length === 0 ? (
        <p className="mt-5 rounded bg-[#f7f7f5] px-3 py-2 text-sm leading-6 text-[#565650]">
          Create a course and add a source before inspecting citations.
        </p>
      ) : (
        <form className="mt-6" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Course
              <select
                className="h-11 rounded border border-black/20 bg-white px-3 text-base font-normal outline-none transition focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/20"
                disabled={isSearching}
                onChange={(event) => chooseCourse(event.target.value)}
                value={courseId}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Question or topic
              <input
                className="h-11 rounded border border-black/20 px-3 text-base font-normal outline-none transition focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/20"
                disabled={!canSearch}
                maxLength={1000}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchState({ kind: "idle" });
                }}
                placeholder="For example, How does photosynthesis work?"
                value={query}
              />
            </label>
          </div>

          {readyDocuments.length === 0 ? (
            <p className="mt-5 rounded bg-[#fff3cf] px-3 py-2 text-sm leading-6 text-[#765a00]">
              Process at least one source in this course to inspect citations.
            </p>
          ) : (
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">Sources to search</legend>
              <p className="mt-1 text-sm leading-6 text-[#565650]">
                All ready sources are selected by default. Clear every box to search every ready source in this course.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {readyDocuments.map((document) => (
                  <label
                    key={document.id}
                    className="flex cursor-pointer items-start gap-3 rounded border border-black/15 bg-[#f7f7f5] px-3 py-3 text-sm leading-5"
                  >
                    <input
                      checked={selectedDocumentIds.includes(document.id)}
                      className="mt-0.5 size-4 accent-[#264653]"
                      disabled={isSearching}
                      onChange={() => toggleDocument(document.id)}
                      type="checkbox"
                    />
                    <span>{document.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <button
            className="mt-6 rounded bg-[#264653] px-5 py-3 font-semibold text-white transition hover:bg-[#1d3741] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSearch}
            type="submit"
          >
            {isSearching ? "Finding passages…" : "Find source passages"}
          </button>
        </form>
      )}

      {searchState.kind === "error" ? (
        <p aria-live="polite" className="mt-5 rounded bg-[#fbe9e5] px-3 py-2 text-sm leading-6 text-[#8c311e]">
          {searchState.message}
        </p>
      ) : null}

      {searchState.kind === "results" ? (
        <div className="mt-7" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Matching passages</h3>
            <span className="text-sm text-[#6b6b67]">
              {searchState.passages.length} {searchState.passages.length === 1 ? "result" : "results"}
            </span>
          </div>

          {searchState.isMock ? (
            <p className="mt-3 rounded bg-[#fff3cf] px-3 py-2 text-sm leading-6 text-[#765a00]">
              Development mode: matching uses exact words, not AI semantics.
            </p>
          ) : null}

          {searchState.passages.length === 0 ? (
            <p className="mt-4 rounded bg-[#f7f7f5] px-3 py-3 text-sm leading-6 text-[#565650]">
              No passages met the match threshold. Try a different topic or select more sources.
            </p>
          ) : (
            <ol className="mt-4 grid gap-3">
              {searchState.passages.map((passage) => (
                <li key={passage.id} className="border-l-2 border-[var(--verified-green)] bg-[#f3f8f7] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--source-teal)]">{formatCitation(passage)}</p>
                    <span className="text-[0.68rem] font-bold tracking-[0.1em] text-[var(--verified-green)] uppercase">Verified source</span>
                  </div>
                  <p className="source-quote mt-2 text-sm leading-6 text-[#30302d]">{passage.content}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
