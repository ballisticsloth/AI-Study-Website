# AI-Powered Study Website — Build Plan

## 1. Delivery strategy

Build the smallest secure end-to-end teacher workflow first:

```text
Sign in → Upload course material → Process and cite it → Generate test/worksheet
→ Teacher edits and saves → Print for students
```

The AI tutor uses the same processed sources. Classroom features, student digital assessment, analytics, and flashcards remain out of the critical path until this loop is reliable with real testers.

## 2. Recommended architecture

| Layer | Choice | Responsibility |
| --- | --- | --- |
| Application | Next.js + TypeScript | Website UI, secure server operations, streaming tutor responses, print views |
| UI | Tailwind CSS + shadcn/ui | Responsive interface, accessible controls, reusable components |
| Auth, database, storage | Supabase | Authentication, PostgreSQL data, private file storage, row-level access control |
| Retrieval | Supabase pgvector + embeddings | Search the owner’s processed document passages and retain citation metadata |
| AI | OpenAI Responses API through the official Node SDK | Assessment generation and source-grounded tutor responses |
| File parsing | `unpdf`/`pdf-parse` for PDF, `mammoth` for DOCX, native text parsing for TXT | Extract text and retain page/heading context |
| Background jobs | Inngest | Process uploads and create embeddings without blocking the browser |
| Validation | Zod + React Hook Form | Validate forms, server inputs, and AI-generated structured data |
| Testing | Vitest + Playwright | Verify logic and critical user journeys |
| Hosting | Vercel + Supabase | Deploy the web app and managed backend services |

### Architectural rules

- Never expose the AI API key in the browser.
- Store original files in private storage paths owned by the authenticated user.
- Use Supabase Row Level Security for every user-owned table and storage access path.
- Store citation metadata alongside each extracted text passage: document ID, display title, page number when available, heading/section when available, and excerpt text.
- Generate assessments as validated structured data, then store them as editable records; do not treat raw AI text as the source of truth.
- Use browser print styles for the first printable release. PDF file generation is optional later.

## 3. Core data model

| Table/entity | Key fields | Purpose |
| --- | --- | --- |
| `profiles` | `id`, display name, created time | Extends authenticated users |
| `courses` | `id`, `owner_id`, title | Private organizational space for materials |
| `documents` | `id`, `course_id`, owner, storage path, file type, status, title | Upload record and processing state |
| `document_sections` | document ID, order, page/heading, original text | Parsed source sections before chunking |
| `document_chunks` | document ID, section ID, content, embedding, page/heading | Searchable passages with citations |
| `generated_materials` | owner, course, type, title, settings, status | Saved worksheet or test |
| `material_questions` | material ID, order, prompt, options, answer, explanation, citations | Editable assessment content |
| `tutor_conversations` | owner, course/topic, title | Private tutor session |
| `tutor_messages` | conversation ID, role, body, citations | Conversation history and citations |

Prepare—without fully implementing—future entities for `classrooms`, `classroom_memberships`, `assignments`, `submissions`, and `feedback`.

## 4. Milestones

**Status rule:** A task is checked only after it has been implemented and
verified. A milestone is complete only when its exit criteria are checked.

### Milestone 0 — Project foundation — In progress

**Target:** July 24–26


- [x] Initialize the Next.js TypeScript project and lint/test tooling.
- [x] Configure Tailwind, environment-variable handling, and project conventions.
- [ ] Add reusable component primitives and complete the visual foundation from the Figma wireframes: navigation, responsive page shell, typography scale, colors, buttons, and loading/empty/error states.
- [ ] Create a deployed preview environment.
- [x] Create the Supabase project, Google authentication setup, private storage bucket, and initial migrations.

**Exit criteria:** [ ] A deployed skeleton has working navigation, sign-in/sign-out, and an authenticated private dashboard shell.

### Milestone 1 — Private material workspace — In progress

**Target:** July 27–30


- [x] Implement private courses/workspaces and document listing.
- [x] Add private PDF, DOCX, and TXT upload with client and server validation.
- [x] Create document storage policies and database row-level security.
- [x] Show upload, processing, ready, and failed status.
- [x] Implement deletion of a document and all its indexed content.

**Exit criteria:** [ ] Each tester can upload supported material and only see their own files after signing in on another device.

### Milestone 2 — Source ingestion and retrieval — In progress

**Target:** July 31–August 3


- [x] Extract content from the three supported file types.
- [x] Retain page metadata for PDFs and heading/section metadata for DOCX/TXT when available.
- [x] Split extracted text into coherent chunks.
- [ ] Create embeddings and store them with source metadata.
- [ ] Implement filtered similarity search scoped to the signed-in user and selected course/documents.
- [ ] Build a simple source-inspection view for debugging citations.

**Exit criteria:** [ ] A query returns relevant passages only from the selected user’s materials, with correct displayable citation data.

### Milestone 3 — Assessment generation, editing, and printing — Not started

**Target:** August 4–7


- [ ] Create the worksheet/test generation form: source selection, type, topic focus, question count, and level.
- [ ] Send retrieved material and a structured generation request to the AI service.
- [ ] Validate the returned assessment schema before storing it.
- [ ] Build the assessment editor for titles, directions, questions, choices, answers, explanations, and citations.
- [ ] Design the generation/editor screen to match the existing Figma wireframe style.
- [ ] Build printer-friendly test and worksheet layouts, including answer-key handling.

**Exit criteria:** [ ] A teacher can create, revise, save, reopen, and print both a multiple-choice test and a worksheet from an upload.

### Milestone 4 — Guidance-first tutor — Not started

**Target:** August 8–10


- [ ] Build the tutor screen using the Figma chat layout as the starting point.
- [ ] Add conversation creation and message persistence.
- [ ] Retrieve course passages for each relevant prompt.
- [ ] Implement a tutor prompt that guides first, checks understanding, and only later provides a full answer.
- [ ] Stream responses to the interface.
- [ ] Render citation cards containing document title, page/section, and compact supporting excerpt.
- [ ] Clearly label general-knowledge responses when no selected source supports them.

**Exit criteria:** [ ] The tutor provides grounded hints with citations, does not expose its source selection across users, and handles no-source cases honestly.

### Milestone 5 — Pre-alpha hardening and real-user test — In progress

**Target:** August 11–12


- [x] Test the upload and source-processing flow with prepared PDF, DOCX, and TXT files.
- [ ] Test with a small invited group creating real accounts and uploading their own allowed materials.
- [ ] Add clear failure states, upload limits, generation quotas, and basic abuse/cost safeguards.
- [ ] Run accessibility and print-layout checks.
- [ ] Fix the highest-impact defects and publish the pre-alpha feedback form.

**Pre-alpha acceptance criteria:** [ ] Selected testers can safely sign in, upload materials, generate/edit/print an assessment, and use the cited tutor without developer intervention.

### Milestone 6 — Feedback-driven final product — Not started

**Target:** August 13–September 15


- [ ] Triage tester feedback into defects, usability improvements, and deferred ideas.
- [ ] Improve parsing quality, citation clarity, tutor guidance quality, and print design.
- [ ] Add quality safeguards and regression tests for the most common generated-content failures.
- [ ] Refine mobile responsiveness, accessibility, onboarding, empty states, and visual identity.
- [ ] Finalize privacy and data-retention policy, user-data disclosures, and permanent account deletion after the intended audience and launch scope are known.
- [ ] Write project documentation and prepare demo materials.

**Exit criteria:** [ ] The core teacher workflow is dependable, visually coherent, and demonstrable with realistic content.

### Milestone 7 — Final validation and capstone delivery — Not started

**Target:** September 16–30


- [ ] Conduct final end-to-end test sessions with representative course materials.
- [ ] Verify privacy boundaries using two different user accounts.
- [ ] Verify all generated materials can be edited, saved, reopened, and printed.
- [ ] Produce final demo data, walkthrough script, architecture explanation, and known-limitations list.
- [ ] Deploy the final version and freeze the release branch.

**Exit criteria:** [ ] Final capstone build is deployed, documented, tested, and presentation-ready.

## 5. Implementation sequence within each feature

Use this order to avoid building UI against unstable assumptions:

1. Define the data schema and access rules.
2. Build server operation and input/output validation.
3. Build the smallest functional interface.
4. Add loading, empty, and error states.
5. Test the full user flow with at least two accounts where privacy applies.
6. Refine layout and visual details against Figma.

## 6. AI implementation details

### Assessment generation

1. The user selects sources and generation settings.
2. The server retrieves a limited, relevant set of document chunks.
3. The AI returns JSON matching a strict schema.
4. The server validates the JSON and persists editable questions and citations.
5. The teacher reviews and changes content before using or printing it.

### Tutor response

1. The user sends a question in a selected course/material context.
2. The server retrieves the most relevant authorized chunks.
3. The prompt instructs the tutor to give a hint, diagnostic question, or next step first.
4. The response includes source references only for retrieved chunks.
5. The interface displays each citation as a compact card with the document, page/section, and excerpt.

### Minimum AI quality checks

- Validate assessment output structure before saving.
- Reject or retry malformed output.
- Require citations for material-grounded claims and questions.
- Keep retrieved source text separate from user instructions to reduce prompt-injection risk from uploaded files.
- Log only the information needed to diagnose failures; avoid storing unnecessary private material in application logs.

## 7. Security and privacy checklist

- [ ] Authentication required for all private product routes.
- [ ] Row Level Security enabled and tested for all user-owned tables.
- [ ] Private storage policies restrict original files to their owner.
- [ ] Server verifies ownership before document processing, retrieval, generation, and deletion.
- [ ] File type and size limits are enforced before storage and processing.
- [ ] Secrets are configured only as server environment variables.
- [ ] A deletion flow removes original file, parsed sections, embeddings, and generated material only when requested.
- [ ] A two-account test demonstrates that cross-account access fails.
- [ ] Sharing/classroom access is not enabled until explicit permission records and policies exist.

## 8. Testing plan

### Automated tests

- Unit tests for chunking, citation formatting, schema validation, ownership checks, and tutor guidance rules.
- Integration tests for upload → processing → retrieval and generation → save → reopen flows.
- End-to-end tests for sign-in, upload, assessment generation, edit, and print views.

### Manual test set

- A text-based PDF with page numbers.
- A DOCX with headings.
- A plain TXT file with clear sections.
- An unsupported file type.
- An oversized file.
- A document with sparse or malformed text.
- Two separate accounts attempting to access one another’s content.

## 9. Cost-control plan for the demo

- Use invite-only or allowlisted sign-up while testing with the selected group.
- Limit upload type, file size, pages/characters processed, and number of documents per account.
- Cap daily assessment-generation and tutor requests per tester.
- Use the lower-cost model route for routine generation and reserve higher-capability requests for cases where evaluation proves the need.
- Monitor usage and errors during the pre-alpha; reduce limits only with a clear user-facing message.

## 10. Deferred backlog

1. Classrooms: invitations by code/link, role memberships, selective content sharing.
2. Assignments, student submissions, automatic multiple-choice scoring, and teacher feedback.
3. Student digital quiz-taking.
4. Flashcards and spaced review.
5. Learning progress, confidence ratings, and recommended review topics.
6. OCR for scanned PDFs, images, slides, audio, and pasted web content.
7. Direct PDF export and richer worksheet templates.
