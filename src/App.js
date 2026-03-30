import React, { useState, useEffect, useCallback, useRef } from "react";

const SIZE = 8;
const BASE = ["🍬", "🍭", "🍫", "🍪", "🧁"];

function randomCandy() {
  return BASE[Math.floor(Math.random() * BASE.length)];
}

// 🔊 SOUND SYSTEM
function useSoundSystem() {
  const soundsRef = useRef({});

  useEffect(() => {
    soundsRef.current = {
      match: new Audio("/sounds/match.mp3"),
      win: new Audio("/sounds/win.mp3"),
    };

    Object.values(soundsRef.current).forEach((audio) => {
      audio.volume = 0.4;
      audio.load();
    });
  }, []);

  const play = (type) => {
    const audio = soundsRef.current[type];
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  };

  const setVolume = (v) => {
    Object.values(soundsRef.current).forEach((a) => (a.volume = v));
  };

  return { play, setVolume };
}

function hasMatch(board) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE - 2; c++) {
      if (board[r][c] === board[r][c + 1] && board[r][c] === board[r][c + 2]) return true;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r < SIZE - 2; r++) {
      if (board[r][c] === board[r + 1][c] && board[r][c] === board[r + 2][c]) return true;
    }
  }
  return false;
}

function createBoard() {
  let board;
  do {
    board = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, randomCandy)
    );
  } while (hasMatch(board));
  return board;
}

export default function CandyGame() {
  const [screen, setScreen] = useState("splash");
  const [board, setBoard] = useState(createBoard());
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(20);
  const [level, setLevel] = useState(1);
  const [goal, setGoal] = useState(300);
  const [animating, setAnimating] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const sound = useSoundSystem();
  const soundRef = useRef();

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    const finalVolume = isMuted ? 0 : volume;
    soundRef.current?.setVolume(finalVolume);
  }, [volume, isMuted]);

  function startGame() {
    setBoard(createBoard());
    setScore(0);
    setMoves(20);
    setGoal(300 + level * 200);
    setScreen("game");
  }

  function isAdjacent(a, b) {
    return (
      (Math.abs(a.row - b.row) === 1 && a.col === b.col) ||
      (Math.abs(a.col - b.col) === 1 && a.row === b.row)
    );
  }

  function swap(board, a, b) {
    const newBoard = board.map((r) => [...r]);
    const temp = newBoard[a.row][a.col];
    newBoard[a.row][a.col] = newBoard[b.row][b.col];
    newBoard[b.row][b.col] = temp;
    return newBoard;
  }

  function handleClick(row, col) {
    if (moves <= 0 || animating || swapping || isPaused) return;

    if (!selected) {
      setSelected({ row, col });
    } else {
      if (!isAdjacent(selected, { row, col })) {
        setSelected(null);
        return;
      }

      const newBoard = swap(board, selected, { row, col });
      setSwapping(true);
      setBoard(newBoard);

      setTimeout(() => {
        if (hasMatch(newBoard)) {
          setMoves((m) => m - 1);
          sound.play("match");
        } else {
          const reverted = swap(newBoard, selected, { row, col });
          setBoard(reverted);
          setMoves((m) => m - 1);
        }
        setSwapping(false);
      }, 200);

      setSelected(null);
    }
  }

  function drop(board) {
    for (let c = 0; c < SIZE; c++) {
      let empty = SIZE - 1;
      for (let r = SIZE - 1; r >= 0; r--) {
        if (board[r][c]) {
          board[empty][c] = board[r][c];
          empty--;
        }
      }
      for (let r = empty; r >= 0; r--) {
        board[r][c] = randomCandy();
      }
    }
  }

  const processMatches = useCallback(() => {
    let newBoard = board.map((r) => [...r]);
    let matched = 0;

    for (let r = 0; r < SIZE; r++) {
      let count = 1;
      for (let c = 1; c <= SIZE; c++) {
        if (c < SIZE && newBoard[r][c] === newBoard[r][c - 1]) count++;
        else {
          if (count >= 3) {
            for (let k = 0; k < count; k++) newBoard[r][c - 1 - k] = null;
            matched += count;
          }
          count = 1;
        }
      }
    }

    for (let c = 0; c < SIZE; c++) {
      let count = 1;
      for (let r = 1; r <= SIZE; r++) {
        if (r < SIZE && newBoard[r][c] === newBoard[r - 1][c]) count++;
        else {
          if (count >= 3) {
            for (let k = 0; k < count; k++) newBoard[r - 1 - k][c] = null;
            matched += count;
          }
          count = 1;
        }
      }
    }

    if (matched > 0) {
      setAnimating(true);

      setTimeout(() => {
        drop(newBoard);
        setBoard(newBoard);
        setScore((s) => s + matched * 30);
        soundRef.current?.play("match");
        setAnimating(false);
      }, 200);
    }
  }, [board]);

  useEffect(() => {
    if (screen !== "game" || isPaused) return;
    const t = setInterval(processMatches, 300);
    return () => clearInterval(t);
  }, [processMatches, screen, isPaused]);

  useEffect(() => {
    if (score >= goal && screen === "game") {
      soundRef.current?.play("win");
      setScreen("win");
    }
  }, [score, goal, screen]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "linear-gradient(135deg,#667eea,#764ba2)",
      fontFamily: "sans-serif"
    }}>

      {/* ⚙️ */}
      <div
        style={{ position: "absolute", top: 20, right: 20, cursor: "pointer" }}
        onClick={() => setShowSettings(!showSettings)}
      >
        ⚙️
      </div>

      {/* MENU */}
      {showSettings && (
        <div style={{
          position: "absolute",
          top: 60,
          right: 20,
          background: "white",
          padding: 15,
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minWidth: 200
        }}>
          <div>Nível: {level}</div>
          <div>Meta: {goal}</div>

          <input type="range" min="0" max="1" step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />

          <button onClick={() => setIsMuted(m => !m)}>
            {isMuted ? "🔈 Ativar som" : "🔇 Mutar"}
          </button>

          <button onClick={() => setIsPaused(p => !p)}>
            {isPaused ? "▶️ Continuar" : "⏸️ Pausar"}
          </button>

          <button onClick={() => startGame()}>🔁 Reiniciar</button>

          <button onClick={() => setScreen("splash")}>❌ Desistir</button>
        </div>
      )}

      {/* SPLASH */}
      {screen === "splash" && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "white",
          textAlign: "center"
        }}>
          <h1 style={{
            fontSize: 48,
            marginBottom: 10,
            textShadow: "0 4px 10px rgba(0,0,0,0.5)"
          }}>
            🍬 Candy Pro
          </h1>

          <p style={{ marginBottom: 30 }}>
            Combine doces e alcance a meta!
          </p>

          <button
            onClick={startGame}
            style={{
              padding: "14px 32px",
              fontSize: 18,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(90deg,#ff7e5f,#feb47b)",
              color: "white"
            }}
          >
            ▶️ Iniciar
          </button>
        </div>
      )}

      {/* GAME */}
      {screen === "game" && (
        <>
          <div style={{ color: "white" }}>
            Score: {score} | Moves: {moves} | Meta: {goal} | Nível: {level}
          </div>

          <div style={{ width: 300, height: 10, background: "#ddd", margin: 10 }}>
            <div style={{
              width: `${Math.min((score / goal) * 100, 100)}%`,
              height: "100%",
              background: "lime"
            }} />
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${SIZE},40px)`,
            gap: 5
          }}>
            {board.map((row, r) =>
              row.map((cell, c) => (
                <div
                  key={r + "-" + c}
                  onClick={() => handleClick(r, c)}
                  style={{
                    width: 40,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "white",
                    borderRadius: 8
                  }}
                >
                  {cell}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* WIN */}
      {screen === "win" && (
        <div style={{ color: "white", textAlign: "center" }}>
          <h1>🎉 Vitória!</h1>
          <p>Nível {level} concluído</p>
          <p>Pontuação: {score}</p>

          <div style={{ fontSize: 30 }}>
            {score >= goal * 1.5 ? "⭐⭐⭐" : score >= goal * 1.2 ? "⭐⭐" : "⭐"}
          </div>

          <button onClick={() => { setLevel(l => l + 1); startGame(); }}>
            🚀 Próximo nível
          </button>
        </div>
      )}

    </div>
  );
}