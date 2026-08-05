type TutorHistoryItem = {
  role: unknown;
  citations: unknown;
};

/** A no-source reply never counts as the learner's completed guided attempt. */
export function hasPriorGroundedTutorReply(messages: TutorHistoryItem[]) {
  return messages.some(
    (message) =>
      message.role === "assistant" && Array.isArray(message.citations) && message.citations.length > 0,
  );
}
