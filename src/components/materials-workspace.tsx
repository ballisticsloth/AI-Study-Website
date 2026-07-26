"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";

import {
  cancelPreparedDocument,
  createCourse,
  deleteDocument,
  processDocument,
  prepareDocumentUpload,
} from "@/app/materials/actions";
import {
  COURSE_MATERIALS_BUCKET,
  documentStatusLabel,
  documentTitleFromFilename,
  formatFileSize,
  getSupportedDocumentType,
  MAX_DOCUMENT_SIZE_BYTES,
  RESUMABLE_UPLOAD_THRESHOLD_BYTES,
  type CourseSummary,
  type DocumentSummary,
} from "@/lib/materials";
import { createClient } from "@/lib/supabase/client";

type MaterialsWorkspaceProps = {
  initialCourses: CourseSummary[];
  documents: DocumentSummary[];
};

type Notice = {
  tone: "error" | "success";
  message: string;
};

const newCourseValue = "__new_course__";

function resumableUploadEndpoint() {
  const projectUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);

  if (projectUrl.hostname.endsWith(".supabase.co")) {
    const projectRef = projectUrl.hostname.split(".")[0];
    return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }

  return new URL("/storage/v1/upload/resumable", projectUrl).toString();
}

async function uploadWithProgress({
  file,
  storagePath,
  mimeType,
  onProgress,
}: {
  file: File;
  storagePath: string;
  mimeType: string;
  onProgress: (percentage: number) => void;
}) {
  const supabase = createClient();

  if (file.size <= RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    const { error } = await supabase.storage.from(COURSE_MATERIALS_BUCKET).upload(storagePath, file, {
      cacheControl: "0",
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      throw error;
    }

    onProgress(100);
    return;
  }

  // getSession is used here only to forward the raw access token to Supabase
  // Storage, which validates it server-side before accepting any upload.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your session expired before the upload could begin.");
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: resumableUploadEndpoint(),
      retryDelays: [0, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: COURSE_MATERIALS_BUCKET,
        objectName: storagePath,
        contentType: mimeType,
        cacheControl: "0",
      },
      chunkSize: RESUMABLE_UPLOAD_THRESHOLD_BYTES,
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess() {
        resolve();
      },
    });

    upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }

        upload.start();
      })
      .catch(reject);
  });
}

function statusClasses(status: DocumentSummary["status"]) {
  if (status === "ready") {
    return "bg-[#e6f4ee] text-[#1f6b51]";
  }

  if (status === "failed") {
    return "bg-[#fbe9e5] text-[#a13d27]";
  }

  return "bg-[#fff3cf] text-[#765a00]";
}

export function MaterialsWorkspace({ initialCourses, documents }: MaterialsWorkspaceProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newlyCreatedCourses, setNewlyCreatedCourses] = useState<CourseSummary[]>([]);
  const [courseChoice, setCourseChoice] = useState(
    initialCourses[0]?.id ?? newCourseValue,
  );
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleWasEdited, setTitleWasEdited] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingDocumentId, setProcessingDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const isProcessingSource = processingDocumentId !== null;
  const isBusy = isUploading || isProcessingSource;
  const courses = [
    ...initialCourses,
    ...newlyCreatedCourses.filter(
      (createdCourse) => !initialCourses.some((course) => course.id === createdCourse.id),
    ),
  ];

  function chooseFile(nextFile: File | null) {
    setNotice(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    const fileType = getSupportedDocumentType(nextFile.name);

    if (!fileType) {
      setFile(null);
      setNotice({ tone: "error", message: "Choose a PDF, DOCX, or TXT file." });
      return;
    }

    if (nextFile.size > MAX_DOCUMENT_SIZE_BYTES) {
      setFile(null);
      setNotice({ tone: "error", message: "Choose a file that is 20 MB or smaller." });
      return;
    }

    if (nextFile.size === 0) {
      setFile(null);
      setNotice({ tone: "error", message: "Choose a file that is not empty." });
      return;
    }

    setFile(nextFile);

    if (!titleWasEdited) {
      setTitle(documentTitleFromFilename(nextFile.name));
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!file) {
      setNotice({ tone: "error", message: "Choose a course file to upload." });
      return;
    }

    const fileType = getSupportedDocumentType(file.name);

    if (!fileType) {
      setNotice({ tone: "error", message: "Choose a PDF, DOCX, or TXT file." });
      return;
    }

    if (!title.trim()) {
      setNotice({ tone: "error", message: "Give this material a clear title." });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    let courseId = courseChoice;

    try {
      if (courseChoice === newCourseValue) {
        const courseResult = await createCourse(newCourseTitle);

        if ("error" in courseResult) {
          setNotice({ tone: "error", message: courseResult.error });
          return;
        }

        courseId = courseResult.course.id;
        setNewlyCreatedCourses((currentCourses) => [...currentCourses, courseResult.course]);
        setCourseChoice(courseResult.course.id);
        setNewCourseTitle("");
      }

      const prepared = await prepareDocumentUpload({
        courseId,
        title,
        originalFilename: file.name,
        byteSize: file.size,
        extension: fileType.extension,
      });

      if ("error" in prepared) {
        setNotice({ tone: "error", message: prepared.error });
        return;
      }

      try {
        await uploadWithProgress({
          file,
          storagePath: prepared.document.storagePath,
          mimeType: prepared.document.mimeType,
          onProgress: setUploadProgress,
        });
      } catch {
        const supabase = createClient();
        await supabase.storage
          .from(COURSE_MATERIALS_BUCKET)
          .remove([prepared.document.storagePath]);
        await cancelPreparedDocument(prepared.document.id);
        setNotice({
          tone: "error",
          message: "The file could not be uploaded. Your private workspace was left unchanged.",
        });
        return;
      }

      setFile(null);
      setTitle("");
      setTitleWasEdited(false);
      setUploadProgress(100);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setProcessingDocumentId(prepared.document.id);
      const processingResult = await processDocument(prepared.document.id);

      if ("error" in processingResult) {
        setNotice({
          tone: "error",
          message: `Material uploaded privately, but source processing needs attention: ${processingResult.error}`,
        });
      } else {
        setNotice({
          tone: "success",
          message: `Material uploaded and processed into ${processingResult.processed.chunks} citation-ready source passages.`,
        });
      }

      router.refresh();
    } finally {
      setIsUploading(false);
      setProcessingDocumentId(null);
    }
  }

  async function handleProcess(document: DocumentSummary) {
    setNotice(null);
    setProcessingDocumentId(document.id);

    try {
      const result = await processDocument(document.id);

      if ("error" in result) {
        setNotice({ tone: "error", message: result.error });
        return;
      }

      setNotice({
        tone: "success",
        message: `Source processing finished: ${result.processed.chunks} citation-ready passages are available.`,
      });
    } finally {
      setProcessingDocumentId(null);
      router.refresh();
    }
  }

  async function handleDownload(document: DocumentSummary) {
    setNotice(null);
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(COURSE_MATERIALS_BUCKET)
      .download(document.storagePath);

    if (error || !data) {
      setNotice({ tone: "error", message: "The private file could not be downloaded. Try again." });
      return;
    }

    const url = URL.createObjectURL(data);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = document.originalFilename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(document: DocumentSummary) {
    const shouldDelete = window.confirm(
      `Delete “${document.title}”? This removes the original private file and its record.`,
    );

    if (!shouldDelete) {
      return;
    }

    setNotice(null);
    setDeletingDocumentId(document.id);

    try {
      const result = await deleteDocument(document.id);

      if (result.error) {
        setNotice({ tone: "error", message: result.error });
        return;
      }

      setNotice({ tone: "success", message: "Material deleted." });
      router.refresh();
    } finally {
      setDeletingDocumentId(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:px-12 lg:py-14">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">
              Private workspace
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Course materials</h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#565650]">
              Upload files for a course, keep them private, and prepare them for source-grounded study tools.
            </p>
          </div>
          <p className="rounded-full border border-[#264653]/20 bg-[#f0f6f5] px-3 py-1.5 text-sm font-medium text-[#264653]">
            Only you can access these files
          </p>
        </div>

        <form
          className="mt-8 rounded-xl border border-black/15 bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.05)] sm:p-7"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Upload material</h2>
              <p className="mt-1 text-sm leading-6 text-[#565650]">PDF, DOCX, or TXT · up to 20 MB</p>
            </div>
            {isBusy ? (
              <span className="text-sm font-semibold text-[#264653]">
                {isProcessingSource ? "Processing source…" : `${uploadProgress}%`}
              </span>
            ) : null}
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Existing course
              <select
                className="h-11 rounded border border-black/20 bg-white px-3 text-base font-normal outline-none transition focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/20"
                disabled={isBusy}
                onChange={(event) => setCourseChoice(event.target.value)}
                value={courseChoice}
              >
                <option value={newCourseValue}>Create a new course…</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            {courseChoice === newCourseValue ? (
              <label className="grid gap-2 text-sm font-semibold">
                New course name
                <input
                  className="h-11 rounded border border-black/20 px-3 text-base font-normal outline-none transition focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/20"
                  disabled={isBusy}
                  maxLength={120}
                  onChange={(event) => setNewCourseTitle(event.target.value)}
                  placeholder="For example, Biology 10"
                  required
                  value={newCourseTitle}
                />
              </label>
            ) : (
              <div className="rounded border border-dashed border-black/15 bg-[#f7f7f5] px-3 py-2 text-sm leading-6 text-[#565650]">
                Files stay organized in the selected course and are not shared automatically.
              </div>
            )}
          </div>

          <div className="mt-5">
            <label
              className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#264653]/35 bg-[#f0f6f5] px-5 py-7 text-center transition hover:border-[#264653] hover:bg-[#e8f0ef]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <span className="text-base font-semibold text-[#264653]">
                {file ? file.name : "Choose a file or drag it here"}
              </span>
              <span className="mt-2 text-sm text-[#565650]">
                {file ? formatFileSize(file.size) : "Supported formats: PDF, DOCX, and TXT"}
              </span>
              <input
                ref={fileInputRef}
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="sr-only"
                disabled={isBusy}
                onChange={handleFileChange}
                type="file"
              />
            </label>
          </div>

          <label className="mt-5 grid gap-2 text-sm font-semibold">
            Material title
            <input
              className="h-11 rounded border border-black/20 px-3 text-base font-normal outline-none transition focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/20"
              disabled={isBusy}
              maxLength={255}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleWasEdited(true);
              }}
              placeholder="For example, Cell Structure Notes"
              required
              value={title}
            />
          </label>

          {isBusy ? (
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e4e4df]" aria-label="Upload progress">
              <div
                className={`h-full bg-[#264653] transition-[width] ${
                  isProcessingSource ? "w-full animate-pulse" : ""
                }`}
                style={isProcessingSource ? undefined : { width: `${uploadProgress}%` }}
              />
            </div>
          ) : null}

          {notice ? (
            <p
              aria-live="polite"
              className={`mt-5 rounded px-3 py-2 text-sm leading-6 ${
                notice.tone === "error"
                  ? "bg-[#fbe9e5] text-[#8c311e]"
                  : "bg-[#e6f4ee] text-[#1f6b51]"
              }`}
            >
              {notice.message}
            </p>
          ) : null}

          <button
            className="mt-6 rounded bg-[#264653] px-5 py-3 font-semibold text-white transition hover:bg-[#1d3741] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            type="submit"
          >
            {isProcessingSource ? "Processing source…" : isUploading ? "Uploading…" : "Upload privately"}
          </button>
        </form>

        <div className="mt-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Your uploaded materials</h2>
              <p className="mt-1 text-sm text-[#565650]">Original files are private and available to download.</p>
            </div>
            <span className="text-sm text-[#6b6b67]">{documents.length} total</span>
          </div>

          {documents.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-black/20 bg-white px-6 py-10 text-center text-[#565650]">
              Your first uploaded file will appear here.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-black/15 bg-white">
              {documents.map((document) => {
                const course = courses.find((item) => item.id === document.courseId);
                const type = getSupportedDocumentType(document.originalFilename);
                const isDeleting = deletingDocumentId === document.id;
                const isProcessingThisDocument = processingDocumentId === document.id;
                const canProcess = document.status === "uploading" || document.status === "failed";

                return (
                  <article
                    key={document.id}
                    className="flex flex-col gap-4 border-b border-black/10 p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#e8f0ef] px-2 py-1 text-xs font-bold tracking-wide text-[#264653]">
                          {type?.label ?? "FILE"}
                        </span>
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClasses(document.status)}`}>
                          {documentStatusLabel(document.status)}
                        </span>
                      </div>
                      <h3 className="mt-3 truncate text-base font-semibold">{document.title}</h3>
                      <p className="mt-1 truncate text-sm text-[#565650]">
                        {course?.title ?? "Private course"} · {document.originalFilename} · {formatFileSize(document.byteSize)}
                      </p>
                      {document.status === "failed" && document.processingError ? (
                        <p className="mt-2 max-w-xl text-sm leading-6 text-[#a13d27]">
                          {document.processingError}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canProcess ? (
                        <button
                          className="rounded border border-[#264653]/35 px-3 py-2 text-sm font-semibold text-[#264653] transition hover:bg-[#264653] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isBusy}
                          onClick={() => handleProcess(document)}
                          type="button"
                        >
                          {isProcessingThisDocument
                            ? "Processing…"
                            : document.status === "failed"
                              ? "Retry processing"
                              : "Process source"}
                        </button>
                      ) : null}
                      <button
                        className="rounded border border-black/25 px-3 py-2 text-sm font-semibold transition hover:bg-black hover:text-white"
                        disabled={isBusy}
                        onClick={() => handleDownload(document)}
                        type="button"
                      >
                        Download
                      </button>
                      <button
                        className="rounded border border-[#b94c35]/35 px-3 py-2 text-sm font-semibold text-[#9a3926] transition hover:bg-[#b94c35] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isDeleting || isBusy}
                        onClick={() => handleDelete(document)}
                        type="button"
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="self-start rounded-xl border border-black/15 bg-white p-6 shadow-[0_12px_34px_rgba(0,0,0,0.05)] lg:sticky lg:top-6">
        <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">How it works</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Build a trustworthy source library.</h2>
        <ol className="mt-6 space-y-5 text-sm leading-6 text-[#565650]">
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#264653] text-xs font-bold text-white">1</span>
            <span>Choose or create a private course workspace.</span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#264653] text-xs font-bold text-white">2</span>
            <span>Upload a supported source file and give it a clear title.</span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#264653] text-xs font-bold text-white">3</span>
            <span>The app extracts page- or section-aware passages for future worksheets, tests, and tutoring.</span>
          </li>
        </ol>
        <div className="mt-7 rounded-lg border border-[#264653]/15 bg-[#f0f6f5] p-4 text-sm leading-6 text-[#264653]">
          Files are never public. Sharing with a class will be a separate, explicit feature later.
        </div>
      </aside>
    </div>
  );
}
