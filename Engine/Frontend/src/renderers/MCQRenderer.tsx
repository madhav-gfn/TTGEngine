import { useEffect, useState } from "react";
import type { GameRendererProps, InteractionCommand, MCQLevelConfig, MCQQuestion } from "@/core/types";
import { useInputCapture } from "@/hooks/useInputCapture";
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
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setQuestions(buildQuestionSet(mcqLevel));
    setQuestionIndex(0);
    setSelectedId(null);
    setFocusedIndex(0);
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
    setFocusedIndex(0);
    setSelectedId(null);
    setLocked(false);
  }

  function handleCommand(command: InteractionCommand): void {
    if (isPaused) {
      return;
    }

    if (command.type === "move" || command.type === "focus") {
      const step =
        command.type === "move"
          ? (command.direction === "up" || command.direction === "left" ? -1 : 1)
          : (command.direction === "previous" ? -1 : 1);

      setFocusedIndex((current) => Math.max(0, Math.min(question.options.length - 1, current + step)));
      return;
    }

    if ((command.type === "select" || command.type === "submit") && !locked) {
      selectOption(question.options[focusedIndex]?.id ?? question.options[0]?.id ?? "");
      return;
    }

    if ((command.type === "select" || command.type === "submit") && locked) {
      nextQuestion();
    }
  }

  const captureRef = useInputCapture(!isPaused, config.interactionConfig, handleCommand);

  return (
    <section className="renderer-shell" ref={captureRef} tabIndex={0}>
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Aptitude Blitz</p>
          <h3 className="renderer-title">Question {questionIndex + 1} / {questions.length}</h3>
        </div>
        <span className="question-tag">
          {question.category ?? question.difficulty}
          {mcqLevel.negativeMarking ? " / negative marking" : ""}
        </span>
      </div>
      <p className="status-line">Use arrow keys to move between options, then press Enter or Space to answer.</p>
      <h4 className="question-title">{question.question}</h4>
      <div className="option-list">
        {question.options.map((option, optionIndex) => {
          const isCorrect = locked && option.id === question.correctOptionId;
          const isWrong = locked && selectedId === option.id && option.id !== question.correctOptionId;
          const isFocused = optionIndex === focusedIndex;
          return (
            <button
              key={option.id}
              type="button"
              className={`option-card ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""} ${isFocused ? "is-focused" : ""}`.trim()}
              onClick={() => {
                setFocusedIndex(optionIndex);
                selectOption(option.id);
              }}
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
