import { useEffect, useState, type FormEvent } from "react";
import type { GameRendererProps, InteractionCommand, WordEntry, WordLevelConfig } from "@/core/types";
import { useInputCapture } from "@/hooks/useInputCapture";

function canSpell(word: string, letters: string[]): boolean {
  const counts = new Map<string, number>();
  letters.forEach((letter) => counts.set(letter, (counts.get(letter) ?? 0) + 1));

  return word.split("").every((letter) => {
    const next = counts.get(letter) ?? 0;
    if (next === 0) {
      return false;
    }

    counts.set(letter, next - 1);
    return true;
  });
}

function findWordEntry(word: string, entries: WordEntry[]): WordEntry | undefined {
  return entries.find((entry) => entry.word.toUpperCase() === word.toUpperCase());
}

export function WordRenderer({ config, level, levelIndex, onAction, onComplete, isPaused }: GameRendererProps) {
  const wordLevel = level as WordLevelConfig;
  const [input, setInput] = useState("");
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [status, setStatus] = useState("Build words from the tiles.");
  const [hint, setHint] = useState<string | null>(null);

  const allWords = [...wordLevel.validWords, ...(wordLevel.bonusWords ?? [])];

  useEffect(() => {
    setInput("");
    setFoundWords([]);
    setStatus("Build words from the tiles.");
    setHint(null);
  }, [config.gameId, levelIndex, wordLevel]);

  function completeIfFinished(nextFound: string[]): void {
    const completedWords = wordLevel.validWords.filter((entry) => nextFound.includes(entry.word));
    if (completedWords.length === wordLevel.validWords.length) {
      onComplete({
        completed: true,
        correctActions: 0,
        wrongActions: 0,
        totalActions: 0,
        hintsUsed: 0,
        metadata: { foundWords: nextFound },
      });
    }
  }

  function submitCandidate(candidate: string): void {
    if (isPaused) {
      return;
    }

    if (!candidate) {
      return;
    }

    if (candidate.length < wordLevel.minWordLength || candidate.length > wordLevel.maxWordLength) {
      onAction({ type: "wrong" });
      setStatus(`Word length must stay between ${wordLevel.minWordLength} and ${wordLevel.maxWordLength}.`);
      return;
    }

    if (!canSpell(candidate, wordLevel.availableLetters)) {
      onAction({ type: "wrong" });
      setStatus("Those letters do not fit the rack.");
      return;
    }

    if (foundWords.includes(candidate)) {
      setStatus("You already found that word.");
      return;
    }

    const match = findWordEntry(candidate, allWords);
    if (!match) {
      onAction({ type: "wrong" });
      setStatus("That word is not in this round's bank.");
      return;
    }

    const nextFound = [...foundWords, candidate];
    setFoundWords(nextFound);
    onAction({ type: "correct", points: match.points });
    setInput("");
    setStatus(`${candidate} locked in for ${match.points} points.`);
    completeIfFinished(nextFound);
  }

  function submitWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitCandidate(input.trim().toUpperCase());
  }

  function requestHint() {
    if (isPaused) {
      return;
    }

    const nextWord = wordLevel.validWords.find((entry) => !foundWords.includes(entry.word));
    if (!nextWord) {
      return;
    }

    setHint(`${nextWord.word[0]}... (${nextWord.word.length} letters)`);
    setStatus("Hint revealed. Use it wisely.");
    onAction({ type: "hint" });
  }

  function handleCommand(command: InteractionCommand): void {
    if (isPaused) {
      return;
    }

    if (command.type === "type" && /^[A-Za-z]$/.test(command.value)) {
      setInput((current) => `${current}${command.value.toUpperCase()}`);
      return;
    }

    if (command.type === "backspace") {
      setInput((current) => current.slice(0, -1));
      return;
    }

    if (command.type === "submit" || command.type === "select") {
      submitCandidate(input.trim().toUpperCase());
      return;
    }

    if (command.type === "hint") {
      requestHint();
    }
  }

  const captureRef = useInputCapture(!isPaused, config.interactionConfig, handleCommand);

  return (
    <section className="renderer-shell" ref={captureRef} tabIndex={0}>
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Word Builder</p>
          <h3 className="renderer-title">Level {wordLevel.levelNumber}</h3>
        </div>
        <button className="button button-secondary" onClick={requestHint} type="button" disabled={isPaused}>
          Hint
        </button>
      </div>
      <p className="status-line">Type directly, or focus the board and use the keyboard without clicking the input first.</p>
      <div className="letter-rack">
        {wordLevel.availableLetters.map((letter, index) => (
          <span key={`${letter}-${index}`} className="letter-tile">
            {letter}
          </span>
        ))}
      </div>
      <form className="word-form" onSubmit={submitWord}>
        <input
          className="word-input"
          value={input}
          onChange={(event) => setInput(event.target.value.toUpperCase())}
          disabled={isPaused}
          placeholder="Type a word"
        />
        <button className="button" type="submit" disabled={isPaused}>
          Submit Word
        </button>
      </form>
      <p className="status-line">{status}</p>
      {hint ? <p className="hint-chip">Hint: {hint}</p> : null}
      <div className="word-bank">
        {wordLevel.validWords.map((entry) => (
          <div key={entry.word} className={`word-chip ${foundWords.includes(entry.word) ? "is-found" : ""}`}>
            <span>{foundWords.includes(entry.word) ? entry.word : `${entry.word.length} letters`}</span>
            <span>{entry.points} pts</span>
          </div>
        ))}
      </div>
      <button
        className="button button-secondary"
        type="button"
        onClick={() =>
          onComplete({
            completed: true,
            correctActions: 0,
            wrongActions: 0,
            totalActions: 0,
            hintsUsed: 0,
            metadata: { foundWords },
          })
        }
      >
        Finish Level
      </button>
    </section>
  );
}
