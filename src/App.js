import React, { useState, useEffect, useCallback, useRef } from "react";

const SIZE = 8;
const BASE = ["🍬", "🍭", "🍫", "🍪", "🧁"];
const SWAP_MS = 180;
const CLEAR_MS = 220;

function randomCandy() {
  return BASE[Math.floor(Math.random() * BASE.length)];
}

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

function makeCandy(symbol, row, col) {
  return {
    id: `${Date.now()}-${Math.random()}-${row}-${col}`,
    symbol,
  };
}

function hasMatch(board) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE - 2; c++) {
      const a = board[r][c]?.symbol;
      const b = board[r][c + 1]?.symbol;
      const d = board[r][c + 2]?.symbol;
      if (a && a === b && a === d) return true;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r < SIZE - 2; r++) {
      const a = board[r][c]?.symbol;
      const b = board[r + 1][c]?.symbol;
      const d = board[r + 2][c]?.symbol;
      if (a && a === b && a === d) return true;
    }
  }
  return false;
}

function createBoard() {
  let board;
  do {
    board = Array.from({ length: SIZE }, (_, row) =>
      Array.from({ length: SIZE }, (_, col) => makeCandy(randomCandy(), row, col))
    );
  } while (hasMatch(board));
  return board;
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function getMatches(board) {
  const matchedPositions = new Set();
  let total = 0;

  for (let r = 0; r < SIZE; r++) {
    let count = 1;
    for (let c = 1; c <= SIZE; c++) {
      const current = c < SIZE ? board[r][c]?.symbol : null;
      const prev = board[r][c - 1]?.symbol;
      if (c < SIZE && current && current === prev) {
        count++;
      } else {
        if (count >= 3 && prev) {
          for (let k = 0; k < count; k++) {
            matchedPositions.add(`${r}-${c - 1 - k}`);
          }
          total += count;
        }
        count = 1;
      }
    }
  }

  for (let c = 0; c < SIZE; c++) {
    let count = 1;
    for (let r = 1; r <= SIZE; r++) {
      const current = r < SIZE ? board[r][c]?.symbol : null;
      const prev = board[r - 1][c]?.symbol;
      if (r < SIZE && current && current === prev) {
        count++;
      } else {
        if (count >= 3 && prev) {
          for (let k = 0; k < count; k++) {
            matchedPositions.add(`${r - 1 - k}-${c}`);
          }
          total += count;
        }
        count = 1;
      }
    }
  }

  return { matchedPositions, total };
}

function swapCells(board, a, b) {
  const next = cloneBoard(board);
  const temp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = temp;
  return next;
}

function dropBoard(board) {
  const next = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  for (let c = 0; c < SIZE; c++) {
    let writeRow = SIZE - 1;

    for (let r = SIZE - 1; r >= 0; r--) {
      if (board[r][c]) {
        next[writeRow][c] = board[r][c];
        writeRow--;
      }
    }

    for (let r = writeRow; r >= 0; r--) {
      next[r][c] = makeCandy(randomCandy(), r, c);
    }
  }

  return next;
}

function cellStyleBase(isSelected, isMatched, isPaused) {
  return {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isSelected
      ? "linear-gradient(180deg,#fff4a8,#ffd86f)"
      : "linear-gradient(180deg,#ffffff,#f4e7ff)",
    borderRadius: 14,
    boxShadow: isMatched
      ? "0 0 18px rgba(255,255,255,0.95), 0 0 26px rgba(255,118,170,0.8)"
      : "0 8px 18px rgba(0,0,0,0.22)",
    transform: isMatched
      ? "scale(0.72) rotate(6deg)"
      : isPaused
      ? "scale(0.98)"
      : "scale(1)",
    opacity: isMatched ? 0.2 : 1,
    transition: `transform ${CLEAR_MS}ms ease, opacity ${CLEAR_MS}ms ease, box-shadow ${CLEAR_MS}ms ease, background 160ms ease`,
    cursor: isPaused ? "default" : "grab",
    userSelect: "none",
    fontSize: 26,
    position: "relative",
    overflow: "hidden",
  };
}

export default function CandyGame() {
  const [screen, setScreen] = useState("splash");
  const [board, setBoard] = useState(createBoard());
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(20);
  const [level, setLevel] = useState(1);
  const [goal, setGoal] = useState(300);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [matchedCells, setMatchedCells] = useState(new Set());
  const [floatingText, setFloatingText] = useState(null);
  const [invalidSwap, setInvalidSwap] = useState(null);
  const [draggingFrom, setDraggingFrom] = useState(null);

  const sound = useSoundSystem();
  const soundRef = useRef();

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    const finalVolume = isMuted ? 0 : volume;
    soundRef.current?.setVolume(finalVolume);
  }, [volume, isMuted]);

  const showPoints = (value) => {
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingText({ id, value });
    setTimeout(() => {
      setFloatingText((prev) => (prev?.id === id ? null : prev));
    }, 900);
  };

  const startGame = () => {
    setBoard(createBoard());
    setSelected(null);
    setScore(0);
    setMoves(20);
    setGoal(300 + level * 200);
    setMatchedCells(new Set());
    setIsPaused(false);
    setShowSettings(false);
    setFloatingText(null);
    setInvalidSwap(null);
    setScreen("game");
  };

  const quitToSplash = () => {
    setShowSettings(false);
    setIsPaused(false);
    setScreen("splash");
  };

  const isAdjacent = (a, b) => {
    return (
      (Math.abs(a.row - b.row) === 1 && a.col === b.col) ||
      (Math.abs(a.col - b.col) === 1 && a.row === b.row)
    );
  };

  const resolveBoard = useCallback(async (startingBoard) => {
    let working = cloneBoard(startingBoard);
    let chain = 0;

    while (true) {
      const { matchedPositions, total } = getMatches(working);
      if (matchedPositions.size === 0) break;

      chain += 1;
      setMatchedCells(new Set(matchedPositions));
      soundRef.current?.play("match");
      const gained = total * 30 * chain;
      setScore((prev) => prev + gained);
      showPoints(`+${gained}`);

      await new Promise((resolve) => setTimeout(resolve, CLEAR_MS));

      const cleared = cloneBoard(working);
      matchedPositions.forEach((key) => {
        const [r, c] = key.split("-").map(Number);
        cleared[r][c] = null;
      });

      setMatchedCells(new Set());
      const dropped = dropBoard(cleared);
      working = dropped;
      setBoard(dropped);

      await new Promise((resolve) => setTimeout(resolve, 220));
    }

    return working;
  }, []);

  const tryMove = useCallback(async (from, to) => {
    if (moves <= 0 || isBusy || isPaused || screen !== "game") return;
    if (!isAdjacent(from, to)) return;

    setIsBusy(true);
    const swapped = swapCells(board, from, to);
    setBoard(swapped);

    await new Promise((resolve) => setTimeout(resolve, SWAP_MS));

    if (hasMatch(swapped)) {
      setMoves((prev) => prev - 1);
      await resolveBoard(swapped);
    } else {
      setInvalidSwap({ from, to });
      await new Promise((resolve) => setTimeout(resolve, 120));
      const reverted = swapCells(swapped, from, to);
      setBoard(reverted);
      setMoves((prev) => prev - 1);
      await new Promise((resolve) => setTimeout(resolve, SWAP_MS));
      setInvalidSwap(null);
    }

    setSelected(null);
    setDraggingFrom(null);
    setIsBusy(false);
  }, [moves, isBusy, isPaused, screen, board, resolveBoard]);

  const handleClick = async (row, col) => {
    if (moves <= 0 || isBusy || isPaused || screen !== "game") return;

    if (!selected) {
      setSelected({ row, col });
      return;
    }

    const target = { row, col };
    if (!isAdjacent(selected, target)) {
      setSelected({ row, col });
      return;
    }

    await tryMove(selected, target);
  };

  const handleDragStart = (row, col) => {
    if (moves <= 0 || isBusy || isPaused || screen !== "game") return;
    setDraggingFrom({ row, col });
    setSelected({ row, col });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (row, col) => {
    if (!draggingFrom) return;
    const to = { row, col };
    const from = draggingFrom;
    await tryMove(from, to);
  };

  const handleDragEnd = () => {
    setDraggingFrom(null);
  };

  useEffect(() => {
    if (score >= goal && screen === "game") {
      soundRef.current?.play("win");
      setScreen("win");
      setIsPaused(false);
      setShowSettings(false);
    }
  }, [score, goal, screen]);

  const starText = score >= goal * 1.5 ? "⭐⭐⭐" : score >= goal * 1.2 ? "⭐⭐" : "⭐";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #8f7cff 0%, #6c63ff 35%, #4b2d7f 100%)",
        fontFamily: "Arial, sans-serif",
        padding: 20,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(10px) scale(0.8); }
          20% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-45px) scale(1.1); }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 rgba(255,255,255,0.0); }
          50% { box-shadow: 0 0 18px rgba(255,255,255,0.65); }
          100% { box-shadow: 0 0 0 rgba(255,255,255,0.0); }
        }
        @keyframes titleBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>

      <div
        style={{ position: "absolute", top: 20, right: 20, cursor: "pointer", fontSize: 28 }}
        onClick={() => setShowSettings((prev) => !prev)}
      >
        ⚙️
      </div>

      {showSettings && (
        <div
          style={{
            position: "absolute",
            top: 64,
            right: 20,
            background: "rgba(255,255,255,0.97)",
            padding: 16,
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: 220,
            boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
            zIndex: 20,
          }}
        >
          <div style={{ fontWeight: 700, color: "#4b2d7f" }}>Configurações</div>
          <div>Nível: {level}</div>
          <div>Meta: {goal}</div>

          <label style={{ fontSize: 14, color: "#4b2d7f" }}>Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />

          <button onClick={() => setIsMuted((m) => !m)}>
            {isMuted ? "🔈 Ativar som" : "🔇 Mutar"}
          </button>

          {screen === "game" && (
            <button onClick={() => setIsPaused((p) => !p)}>
              {isPaused ? "▶️ Continuar" : "⏸️ Pausar"}
            </button>
          )}

          {screen === "game" && <button onClick={startGame}>🔁 Reiniciar</button>}
          <button onClick={quitToSplash}>❌ Sair</button>
        </div>
      )}

      {screen === "splash" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            color: "white",
            gap: 12,
          }}
        >
          <h1
            style={{
              fontSize: 56,
              margin: 0,
              textShadow: "0 8px 18px rgba(0,0,0,0.35)",
              animation: "titleBounce 1.8s ease-in-out infinite",
            }}
          >
            🍬 Candy Pro
          </h1>
          <p style={{ fontSize: 20, margin: 0, opacity: 0.95 }}>
            Combine doces, faça combos e alcance a meta.
          </p>
          <button
            onClick={startGame}
            style={{
              marginTop: 20,
              padding: "16px 34px",
              fontSize: 20,
              borderRadius: 16,
              border: "none",
              cursor: "pointer",
              color: "white",
              background: "linear-gradient(90deg,#ff7e5f,#feb47b)",
              boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
              animation: "pulseGlow 1.7s infinite",
            }}
          >
            ▶️ Iniciar
          </button>
        </div>
      )}

      {screen === "game" && (
        <>
          <div
            style={{
              color: "white",
              marginBottom: 10,
              fontSize: 18,
              fontWeight: 700,
              textShadow: "0 2px 10px rgba(0,0,0,0.25)",
            }}
          >
            Score: {score} | Moves: {moves} | Meta: {goal} | Nível: {level}
          </div>

          <div
            style={{
              width: 360,
              height: 14,
              background: "rgba(255,255,255,0.35)",
              borderRadius: 999,
              marginBottom: 14,
              overflow: "hidden",
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                width: `${Math.min((score / goal) * 100, 100)}%`,
                height: "100%",
                background: "linear-gradient(90deg,#00f260,#0575e6)",
                transition: "width 260ms ease",
                boxShadow: "0 0 18px rgba(0,242,96,0.65)",
              }}
            />
          </div>

          <div style={{ position: "relative" }}>
            {floatingText && (
              <div
                style={{
                  position: "absolute",
                  top: -20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  color: "#fff7a6",
                  fontWeight: 800,
                  fontSize: 28,
                  textShadow: "0 2px 10px rgba(0,0,0,0.35)",
                  animation: "floatUp 900ms ease forwards",
                  pointerEvents: "none",
                  zIndex: 15,
                }}
              >
                {floatingText.value}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${SIZE}, 48px)`,
                gap: 6,
                padding: 16,
                borderRadius: 22,
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 16px 36px rgba(0,0,0,0.22)",
                position: "relative",
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const key = `${r}-${c}`;
                  const isSelected = selected?.row === r && selected?.col === c;
                  const isMatched = matchedCells.has(key);
                  const isInvalidFrom =
                    invalidSwap?.from.row === r && invalidSwap?.from.col === c;
                  const isInvalidTo = invalidSwap?.to.row === r && invalidSwap?.to.col === c;

                  let transform = cellStyleBase(isSelected, isMatched, isPaused).transform;
                  if (isInvalidFrom) transform = "translateX(8px) scale(1.02)";
                  if (isInvalidTo) transform = "translateX(-8px) scale(1.02)";

                  return (
                    <div
                      key={cell.id}
                      draggable={!isPaused && !isBusy}
                      onDragStart={() => handleDragStart(r, c)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(r, c)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleClick(r, c)}
                      style={{
                        ...cellStyleBase(isSelected, isMatched, isPaused),
                        transform,
                      }}
                    >
                      <span
                        style={{
                          filter: isMatched ? "blur(1px)" : "none",
                          transform: isMatched ? "scale(1.2)" : "scale(1)",
                          transition: `transform ${CLEAR_MS}ms ease, filter ${CLEAR_MS}ms ease`,
                        }}
                      >
                        {cell.symbol}
                      </span>
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0))",
                          opacity: 0.45,
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  );
                })
              )}

              {isPaused && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(40,20,70,0.45)",
                    borderRadius: 22,
                    color: "white",
                    fontSize: 34,
                    fontWeight: 800,
                    letterSpacing: 1,
                    textShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  ⏸️ PAUSADO
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {screen === "win" && (
        <div
          style={{
            color: "white",
            textAlign: "center",
            background: "rgba(255,255,255,0.15)",
            padding: "28px 34px",
            borderRadius: 24,
            boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
            backdropFilter: "blur(10px)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 50 }}>🎉 Vitória!</h1>
          <p style={{ fontSize: 22, marginBottom: 8 }}>Nível {level} concluído</p>
          <p style={{ fontSize: 20, marginTop: 0 }}>Pontuação: {score}</p>
          <div style={{ fontSize: 36, marginBottom: 18 }}>{starText}</div>
          <button
            onClick={() => {
              setLevel((l) => l + 1);
              startGame();
            }}
            style={{
              padding: "14px 28px",
              borderRadius: 14,
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 700,
              color: "white",
              background: "linear-gradient(90deg,#00c853,#00b0ff)",
              boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
            }}
          >
            🚀 Próximo nível
          </button>
        </div>
      )}
    </div>
  );
}
