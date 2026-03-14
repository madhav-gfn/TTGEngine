import { useEffect, useState } from "react";
import type { GameRendererProps, MCQLevelConfig, MCQQuestion } from "@/core/types";
import { shuffleArray } from "@/lib/utils";

function buildQuestionSet(level: MCQLevelConfig): MCQQuestion[] {
  const questions = level.shuffleQuestions ? shuffleArray(level.questions) : [...level.questions];
  return questions.map((question) => ({
    ...question,
    options: level.shuffleOptions ? shuffleArray(question.options) : [...question.options],
  }));
}

export function MCQRenderer({ config, level, levelIndex, onAction, onComplete, isPaused }: GameRendererProps) {
  const mcqLevel = level as MCQLevelConfig;
  const [questions, setQuestions] = useState<MCQQuestion[]>(() => buildQuestionSet(mcqLevel));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setQuestions(buildQuestionSet(mcqLevel));
    setQuestionIndex(0);
    setSelectedId(null);
    setLocked(false);
  }, [config.gameId, levelIndex, mcqLevel]);

  const question = questions[questionIndex];

  function selectOption(optionId: string) {
    if (isPaused || locked) {
      return;
    }

    const correct = optionId === question.correctOptionId;
    setSelectedId(optionId);
    setLocked(true);
    onAction({
      type: correct ? "correct" : "wrong",
      points: correct ? config.scoringConfig.basePoints : 0,
    });
  }

  function nextQuestion() {
    if (questionIndex >= questions.length - 1) {
      onComplete({
        completed: true,
        correctActions: 0,
        wrongActions: 0,
        totalActions: 0,
        hintsUsed: 0,
        metadata: { questionCount: questions.length },
      });
      return;
    }

    setQuestionIndex((index) => index + 1);
    setSelectedId(null);
    setLocked(false);
  }

  return (
    <section className="renderer-shell">
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Aptitude Blitz</p>
          <h3 className="renderer-title">Question {questionIndex + 1} / {questions.length}</h3>
        </div>
        <span className="question-tag">{question.category ?? question.difficulty}</span>
      </div>
      <h4 className="question-title">{question.question}</h4>
      <div className="option-list">
        {question.options.map((option) => {
          const isCorrect = locked && option.id === question.correctOptionId;
          const isWrong = locked && selectedId === option.id && option.id !== question.correctOptionId;
          return (
            <button
              key={option.id}
              type="button"
              className={`option-card ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`.trim()}
              onClick={() => selectOption(option.id)}
              disabled={isPaused || locked}
            >
              <span>{option.text}</span>
            </button>
          );
        })}
      </div>
      {locked && question.explanation ? <p className="explanation-box">{question.explanation}</p> : null}
      <button className="button" type="button" onClick={nextQuestion} disabled={!locked}>
        {questionIndex >= questions.length - 1 ? "Finish Level" : "Next Question"}
      </button>
    </section>
  );
}
