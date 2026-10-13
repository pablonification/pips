/**
 * The server's completeness check for a form response (POST /form/{formId}/response answers 400 when it finds any).
 * Self-contained, with structural types, so the web app's tests can check its own rules against this one
 * (apps/web/tests/form.test.ts).
 */
interface Question {
  id: string;
  label: string;
  optional?: boolean;
  dependsOn?: { questionId: string; value: string };
}

/**
 * Returns labels of required questions that were not answered. A question is
 * only required if it doesn't have a `dependsOn`, or its `dependsOn`
 * condition is satisfied by the submitted answers (see plan's judgment call
 * on question #17 — conditionally-required questions aren't required when
 * N/A).
 */
export function findMissingRequiredQuestions(
  sections: Array<{ questions: Question[] }>,
  answers: Array<{ questionId: string; answer: string | string[] }>,
): string[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
  const missing: string[] = [];

  const isAnswered = (questionId: string) => {
    const answer = answerMap.get(questionId);
    if (answer === undefined) return false;
    return Array.isArray(answer) ? answer.length > 0 : answer.trim() !== '';
  };

  const isRequired = (question: Question) => {
    if (question.optional) return false;
    if (!question.dependsOn) return true;
    const dependsAnswer = answerMap.get(question.dependsOn.questionId);
    if (Array.isArray(dependsAnswer)) {
      return dependsAnswer.includes(question.dependsOn.value);
    }
    return dependsAnswer === question.dependsOn.value;
  };

  for (const section of sections) {
    for (const question of section.questions) {
      if (isRequired(question) && !isAnswered(question.id)) {
        missing.push(question.label);
      }
    }
  }

  return missing;
}
