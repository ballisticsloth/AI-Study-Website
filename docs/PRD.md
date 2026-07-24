# AI-Powered Study Website — Product Requirements Document

## 1. Product summary

The AI-Powered Study Website is a teacher-first learning platform that turns private course materials into editable, print-ready assessments and provides a source-grounded AI study tutor. Its purpose is to support genuine learning—retrieval practice, formative feedback, and reflection—rather than simply delivering answers.

The initial product focuses on teachers creating and using materials. Students and classroom workflows are planned for a later phase, but the data model and permissions must allow them without a redesign.

**Working name:** To be decided.

## 2. Problem and opportunity

General AI chat tools are optimized for speed and convenience. They often answer a student’s question directly, may not be grounded in the student’s actual class materials, and offer little support for teacher review or printed classroom use.

Teachers need a private, simple way to upload course content, create relevant assessments, revise the result, and use an AI assistant that guides students toward understanding. The product will differentiate itself by grounding AI in course sources, exposing those sources, and using guidance before answers.

## 3. Goals

### Product goals

1. Let teachers securely upload and organize their own course materials.
2. Generate editable multiple-choice tests and printable worksheets from a selected topic or uploaded materials.
3. Provide an AI tutor that guides a learner before revealing an answer.
4. Ground generated content and tutor responses in uploaded materials whenever applicable.
5. Show a compact citation with the document name, page/section, and a short supporting excerpt.
6. Keep all materials private by default and enforce sharing permissions when classroom features are added.
7. Deliver a functional pre-alpha for selected real testers by August 12, then a polished capstone product by the end of September.

### Success measures

- A tester can create an account, upload a supported file, and see when it is ready to use.
- A teacher can generate, edit, save, and print a multiple-choice test or worksheet based on their material.
- A tutor response based on uploaded material identifies its source and includes a useful excerpt.
- A student-facing tutor does not reveal a direct answer before first giving guidance or prompting an attempt.
- A user cannot access another user’s uploads, generated materials, or conversations.

## 4. Non-goals for the initial release

- Digital student quiz-taking and automatic student scoring.
- Flashcards.
- Progress dashboards, streaks, or mastery analytics.
- Public sharing, public links, or discovery of other users’ materials.
- Classroom creation, invitations, assignments, feedback, and grade views. These are post-MVP stretch features.
- Support for scanned-document OCR, slides, images, audio, web links, or handwritten notes.
- Native mobile applications. The website should remain responsive, but desktop is the design priority.

## 5. Users and roles

### Teacher (primary initial user)

A teacher uploads course content, produces and edits printable materials, and uses the tutor to validate explanations against their sources.

### Student (future user; same base account)

Students will use the same account system. In a future classroom, a user’s permissions are based on their membership role for that classroom rather than on a separate account type.

### Classroom roles (future)

- **Owner/teacher:** creates the classroom, shares materials, creates assignments, reviews work, and gives feedback.
- **Student/member:** can access only content explicitly shared with that classroom or directly with them.

## 6. Core experience

### 6.1 Account and private workspace

- Users can sign up, sign in, and sign out.
- Every user has a private workspace for materials and generated assessments.
- A user’s content remains available across devices after sign-in.
- Sharing is unavailable by default; no content is public.

### 6.2 Course material upload and processing

- Supported initial formats: PDF, DOCX, and TXT.
- A teacher can upload a file and give it a clear title.
- The system reports status: uploading, processing, ready, or failed.
- The system extracts text, retains document/page or section metadata, divides content into searchable passages, and indexes those passages for retrieval.
- The original file remains associated with the extracted material.
- PDFs cite page numbers. DOCX and TXT cite document title plus detected heading/section when available.

### 6.3 Assessment generation

- A teacher can choose one or more uploaded materials and optionally enter a topic of focus.
- A teacher selects either **multiple-choice test** or **worksheet**.
- The teacher can choose basic settings: number of questions, level/grade band, and topic focus.
- Generated content must include source references for the teacher to review.
- A teacher can edit question wording, choices, answers, explanations, directions, title, and source information before saving.
- A teacher can save a generated assessment and reopen it later.
- A teacher can open a print-friendly view and print from the browser.
- Multiple-choice tests include an answer key in the saved/print view. Worksheet answer keys may be generated where appropriate.

### 6.4 AI study tutor

- A user can start a conversation tied to selected uploaded material or a topic of focus.
- When course sources are relevant, the system retrieves relevant passages before generating the response.
- The tutor leads with a question, hint, misconception check, or suggested next step; it must not reveal a direct answer before guidance.
- After the learner has attempted the work or explicitly requests it, the tutor may provide a fuller explanation.
- Source-grounded responses show document title, page/section, and a concise quoted or paraphrased excerpt.
- If no uploaded source supports an answer, the interface clearly marks the response as general knowledge rather than course-material guidance.
- Conversations are private to the account owner unless explicitly shared in a future classroom feature.

## 7. Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Authentication and persistent private user workspaces | Must |
| FR-2 | Secure upload, storage, and deletion of PDF, DOCX, and TXT files | Must |
| FR-3 | Processing status and failure handling for each upload | Must |
| FR-4 | Source retrieval with document/page or section metadata | Must |
| FR-5 | Generate editable multiple-choice tests | Must |
| FR-6 | Generate editable printable worksheets | Must |
| FR-7 | Save, reopen, and print generated materials | Must |
| FR-8 | Guidance-first tutor with source citations and excerpts | Must |
| FR-9 | Responsive desktop-first interface matching the existing Figma wireframes | Must |
| FR-10 | Classroom invitations, assignment distribution, student scores, and feedback | Later |
| FR-11 | Learning analytics and review recommendations | Later |

## 8. Non-functional requirements

### Privacy and access control

- Privacy is the default. Content is visible only to its owner unless an explicit future share permission grants access.
- Authorization must be enforced in the database and storage layer, not only in the user interface.
- AI provider credentials are server-side only.
- Users must be able to delete their uploaded materials and generated work.

### Reliability and quality

- Reject unsupported or oversized uploads with clear guidance.
- Preserve processing errors for troubleshooting without exposing private content.
- Generated output must follow a validated schema so the editor and print view do not receive malformed data.
- Show source citations only when a real retrieved passage supports them; never fabricate a page, source, or excerpt.

### Usability and accessibility

- The interface should use clear status labels and give visible feedback during long-running uploads or generation.
- Assessments must remain readable when printed on standard paper.
- Use semantic controls, keyboard-accessible navigation, sufficient color contrast, and labels for non-text controls.

## 9. Content and AI policy

The tutor system prompt and application rules must prioritize learning behavior:

1. Identify whether the learner is asking for help, a hint, feedback, or a direct answer.
2. Ask for an attempt or provide a graduated hint before explaining the solution.
3. Prefer uploaded course material when it is relevant.
4. Cite the supporting material and include a short relevant excerpt.
5. State uncertainty when the selected sources do not support the claim.
6. Keep the answer age-appropriate and instructional, not merely transactional.

Assessment generation should return structured content including title, directions, questions, answer key, explanations, and citations. The teacher remains the final reviewer and editor.

## 10. Design direction

The existing Figma file establishes the initial desktop layout and navigation patterns for the landing page, sign-in flow, tutor, material uploading, and file browsing. Styling, name, visual identity, and the assessment editor design are intentionally open. The assessment generation/editor will be designed to match the established wireframe patterns when that feature is built.

## 11. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| AI produces a plausible but unsupported answer | Retrieve source passages, require citations, and label unsupported responses as general knowledge. |
| Document parsing loses page/section context | Start with PDFs, DOCX, and TXT only; retain page and heading metadata during ingestion. |
| Demo API cost grows unexpectedly | Use selected-tester access, file-size limits, generation quotas, and model routing appropriate to each job. |
| Upload processing takes too long | Process asynchronously and show durable status rather than keeping users waiting on a single request. |
| Classroom scope delays the pre-alpha | Model future permissions now, but defer classroom UI and workflows until the core teacher loop works. |
| Teachers trust output without review | Make generated content editable and keep source citations visible in the editor. |

## 12. Future direction

After the core teacher loop is reliable, add classrooms where teachers invite students by code or link, selectively share resources and assignments, view submissions/scores, and leave feedback. Add student digital quiz-taking, learning history, confidence ratings, and targeted review recommendations after classroom workflows are established.
