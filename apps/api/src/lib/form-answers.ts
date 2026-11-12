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
 * condition is satisfied by the submitted answers: a conditional question that
 * doesn't apply is not required.
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

interface ChoiceQuestion {
  id: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'rating';
  options?: string[];
}

const RATINGS = ['1', '2', '3', '4', '5'];

/**
 * Why a response doesn't fit its form, or null when it does: every answer is to a question of the form, once; a
 * radio or rating answer is one of its choices, a checkbox answer a list of its options (each once), a text answer a
 * string of at most `maxText` characters. Live Counting and Rekap count what is stored, so a made-up option would
 * show there.
 */
export function findInvalidAnswer(
  sections: Array<{ questions: ChoiceQuestion[] }>,
  answers: Array<{ questionId: string; answer: string | string[] }>,
  maxText: number,
): string | null {
  const questions = new Map(
    sections.flatMap((s) => s.questions).map((q) => [q.id, q]),
  );
  const seen = new Set<string>();
  for (const { questionId, answer } of answers) {
    const question = questions.get(questionId);
    if (!question) return `Unknown question: ${questionId}`;
    if (seen.has(questionId)) return `Answered twice: ${questionId}`;
    seen.add(questionId);
    const choices =
      question.type === 'rating' ? RATINGS : (question.options ?? []);
    const fits =
      question.type === 'checkbox'
        ? Array.isArray(answer) &&
          new Set(answer).size === answer.length &&
          answer.every((a) => choices.includes(a))
        : typeof answer === 'string' &&
          (question.type === 'text' || question.type === 'textarea'
            ? answer.length <= maxText
            : choices.includes(answer));
    if (!fits) return `Answer does not fit question: ${questionId}`;
  }
  return null;
}
