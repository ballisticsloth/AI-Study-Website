export const COURSE_MATERIALS_BUCKET = "course-materials";
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;

export const SUPPORTED_DOCUMENT_TYPES = {
  pdf: {
    mimeType: "application/pdf",
    label: "PDF",
  },
  docx: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "DOCX",
  },
  txt: {
    mimeType: "text/plain",
    label: "TXT",
  },
} as const;

export type SupportedDocumentExtension = keyof typeof SUPPORTED_DOCUMENT_TYPES;
export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";

export type CourseSummary = {
  id: string;
  title: string;
};

export type DocumentSummary = {
  id: string;
  courseId: string;
  title: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  byteSize: number;
  status: DocumentStatus;
  processingError: string | null;
  createdAt: string;
};

export function getSupportedDocumentType(filename: string) {
  const extension = filename.trim().split(".").pop()?.toLowerCase();

  if (!extension || !(extension in SUPPORTED_DOCUMENT_TYPES)) {
    return null;
  }

  return {
    extension: extension as SupportedDocumentExtension,
    ...SUPPORTED_DOCUMENT_TYPES[extension as SupportedDocumentExtension],
  };
}

export function documentTitleFromFilename(filename: string) {
  const lastDot = filename.lastIndexOf(".");
  const baseName = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return baseName.trim() || "Untitled material";
}

export function formatFileSize(byteSize: number) {
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

export function documentStatusLabel(status: DocumentStatus) {
  switch (status) {
    case "uploading":
      return "Uploaded · awaiting processing";
    case "processing":
      return "Processing";
    case "ready":
      return "Ready to use";
    case "failed":
      return "Needs attention";
  }
}
