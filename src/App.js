import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

const BASE = ["🍬", "🍭", "🍫", "🍪", "🧁"];
const SWAP_MS = 180;
const CLEAR_MS = 240;
const STORAGE_KEY = "candy-pro-save";
const MAX_SIZE = 8;

function getBoardSize(level) {
  if (level >= 10) return 8;
  if (level >= 6) return 7;
  if (level >= 3) return 6;
  return 5;
}

function getMovesByLevel(level) {
  return Math.max(12, 20 - Math.floor(level / 2));
}

function getGoalByLevel(level, size) {
  const baseGoal = 180;
  const levelFactor = level * 110;
  const boardFactor = (size - 5) * 140;
  return baseGoal + levelFactor + boardFactor;
}

function randomCandy() {
  return BASE[Math.floor(Math.random() * BASE.length)];
}

function saveGame(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadGame() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function makeCandy(symbol, row, col, special = null) {
  return {
    id: `${Date.now()}-${Math.random()}-${row}-${col}`,
    symbol,
    special,
  };
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function hasMatch(board) {
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 2; c++) {
      const a = board[r][c]?.symbol;
      const b = board[r][c + 1]?.symbol;
      const d = board[r][c + 2]?.symbol;
      if (a && a === b && a === d) return true;
    }
  }

  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size - 2; r++) {
      const a = board[r][c]?.symbol;
      const b = board[r + 1][c]?.symbol;
      const d = board[r + 2][c]?.symbol;
      if (a && a === b && a === d) return true;
    }
  }

  return false;
}

function createBoard(size) {
  let board;
  do {
    board = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => makeCandy(randomCandy(), row, col))
    );
  } while (hasMatch(board));
  return board;
}

function getMatches(board) {
  const size = board.length;
  const matchedPositions = new Set();
  const bonusSpecials = [];
  let total = 0;

  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c <= size; c++) {
      const current = c < size ? board[r][c]?.symbol : null;
      const prev = board[r][c - 1]?.symbol;
      if (c < size && current && current === prev) {
        count++;
      } else {
        if (count >= 3 && prev) {
          for (let k = 0; k < count; k++) {
            matchedPositions.add(`${r}-${c - 1 - k}`);
          }
          total += count;
          if (count >= 4) {
            bonusSpecials.push({
              row: r,
              col: c - 1,
              symbol: prev,
              special: count >= 5 ? "cross" : "line",
            });
          }
        }
        count = 1;
      }
    }
  }

  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r <= size; r++) {
      const current = r < size ? board[r][c]?.symbol : null;
      const prev = board[r - 1][c]?.symbol;
      if (r < size && current && current === prev) {
        count++;
      } else {
        if (count >= 3 && prev) {
          for (let k = 0; k < count; k++) {
            matchedPositions.add(`${r - 1 - k}-${c}`);
          }
          total += count;
          if (count >= 4) {
            bonusSpecials.push({
              row: r - 1,
              col: c,
              symbol: prev,
              special: count >= 5 ? "cross" : "line",
            });
          }
        }
        count = 1;
      }
    }
  }

  return { matchedPositions, total, bonusSpecials };
}

function swapCells(board, a, b) {
  const next = cloneBoard(board);
  const temp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = temp;
  return next;
}

function dropBoard(board) {
  const size = board.length;
  const next = Array.from({ length: size }, () => Array(size).fill(null));

  for (let c = 0; c < size; c++) {
    let writeRow = size - 1;

    for (let r = size - 1; r >= 0; r--) {
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

  const play = useCallback((type) => {
    const audio = soundsRef.current[type];
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  const setVolume = useCallback((v) => {
    Object.values(soundsRef.current).forEach((audio) => {
      audio.volume = v;
    });
  }, []);

  return useMemo(() => ({ play, setVolume }), [play, setVolume]);
}

function Overlay({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(17, 13, 40, 0.55)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalCard({ children, width = 360 }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: width,
        background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,240,255,0.95))",
        borderRadius: 28,
        padding: 28,
        boxSizing: "border-box",
        boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
        border: "1px solid rgba(255,255,255,0.5)",
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, style = {}, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 52,
        borderRadius: 16,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "0 22px",
        color: "white",
        fontWeight: 800,
        fontSize: 16,
        background: disabled
          ? "linear-gradient(90deg,#9aa0b5,#8a90a6)"
          : "linear-gradient(90deg,#ff7a59,#ffb36b)",
        boxShadow: disabled ? "none" : "0 12px 24px rgba(255,122,89,0.35)",
        transition: "transform 140ms ease, opacity 140ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, style = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 46,
        borderRadius: 14,
        border: "1px solid rgba(88, 67, 140, 0.14)",
        cursor: "pointer",
        padding: "0 18px",
        color: "#4b2d7f",
        fontWeight: 700,
        fontSize: 15,
        background: "white",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function TopBar({ score, moves, goal, level }) {
  const progress = Math.min((score / goal) * 100, 100);

  return (
    <div style={{ width: "100%", maxWidth: 470, marginBottom: 18 }}>
      <div
        style={{
          background: "rgba(255,255,255,0.16)",
          backdropFilter: "blur(10px)",
          borderRadius: 22,
          padding: 16,
          boxShadow: "0 14px 28px rgba(0,0,0,0.18)",
          border: "1px solid rgba(255,255,255,0.16)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            color: "white",
            marginBottom: 14,
          }}
        >
          <InfoPill label="Score" value={score} />
          <InfoPill label="Moves" value={moves} />
          <InfoPill label="Meta" value={goal} />
          <InfoPill label="Nível" value={level} />
        </div>

        <div
          style={{
            width: "100%",
            height: 14,
            background: "rgba(255,255,255,0.28)",
            borderRadius: 999,
            overflow: "hidden",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(90deg,#00f260,#0575e6)",
              boxShadow: "0 0 18px rgba(0,242,96,0.55)",
              transition: "width 240ms ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.12)",
        borderRadius: 16,
        padding: "12px 10px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.88 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function SplashScreen({ onStart, savedLevel }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "white",
        maxWidth: 520,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 94,
          height: 94,
          borderRadius: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 42,
          background: "linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.14))",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          marginBottom: 22,
        }}
      >
        🍬
      </div>

      <h1
        style={{
          fontSize: 58,
          lineHeight: 1,
          margin: 0,
          fontWeight: 900,
          letterSpacing: -1,
          textShadow: "0 10px 24px rgba(0,0,0,0.25)",
        }}
      >
        Candy Pro
      </h1>

      <p
        style={{
          fontSize: 20,
          lineHeight: 1.5,
          opacity: 0.95,
          marginTop: 18,
          marginBottom: 28,
          maxWidth: 430,
        }}
      >
        Combine doces, faça combos em cadeia e avance por fases cada vez mais desafiadoras.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 26,
        }}
      >
        <SplashBadge label="Nível salvo" value={savedLevel} />
      </div>

      <PrimaryButton onClick={onStart} style={{ minWidth: 220, fontSize: 18, height: 58 }}>
        ▶️ Iniciar
      </PrimaryButton>
    </div>
  );
}

function SplashBadge({ label, value }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.14)",
        borderRadius: 18,
        padding: "12px 16px",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.84 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function SettingsPanel({
  level,
  goal,
  volume,
  setVolume,
  isMuted,
  setIsMuted,
  isPaused,
  setIsPaused,
  screen,
  onRestart,
  onQuit,
  onClose,
}) {
  return (
    <ModalCard width={320}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ color: "#4b2d7f", fontWeight: 900, fontSize: 24 }}>Configurações</div>
        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: "#f2ecff",
            color: "#4b2d7f",
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <SettingInfo label="Nível" value={level} />
        <SettingInfo label="Meta" value={goal} />
      </div>

      <div style={{ marginBottom: 10, color: "#6a5a91", fontWeight: 700 }}>Volume</div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        style={{ width: "100%", marginBottom: 18 }}
      />

      <div style={{ display: "grid", gap: 10 }}>
        <SecondaryButton onClick={() => setIsMuted((prev) => !prev)}>
          {isMuted ? "🔈 Ativar som" : "🔇 Mutar"}
        </SecondaryButton>

        {screen === "game" && (
          <SecondaryButton onClick={() => setIsPaused((prev) => !prev)}>
            {isPaused ? "▶️ Continuar" : "⏸️ Pausar"}
          </SecondaryButton>
        )}

        {screen === "game" && (
          <SecondaryButton onClick={onRestart}>🔁 Reiniciar fase</SecondaryButton>
        )}

        <PrimaryButton
          onClick={onQuit}
          style={{
            background: "linear-gradient(90deg,#ff5a7a,#ff7b6b)",
            boxShadow: "0 12px 24px rgba(255,90,122,0.28)",
          }}
        >
          ❌ Sair
        </PrimaryButton>
      </div>
    </ModalCard>
  );
}

function SettingInfo({ label, value }) {
  return (
    <div
      style={{
        background: "#f5f1ff",
        borderRadius: 16,
        padding: 14,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, color: "#7b6ca7" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#4b2d7f" }}>{value}</div>
    </div>
  );
}

function WinScreen({ level, score, goal, onNext }) {
  const stars = score >= goal * 1.5 ? "⭐⭐⭐" : score >= goal * 1.2 ? "⭐⭐" : "⭐";

  return (
    <Overlay>
      <ModalCard width={390}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 62, marginBottom: 8 }}>🎉</div>
          <h1 style={{ margin: 0, fontSize: 42, color: "#4b2d7f" }}>Vitória!</h1>
          <p style={{ fontSize: 20, color: "#6a5a91", marginBottom: 10 }}>Nível {level} concluído</p>
          <div style={{ fontSize: 38, marginBottom: 16 }}>{stars}</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 22,
            }}
          >
            <SettingInfo label="Pontuação" value={score} />
            <SettingInfo label="Meta" value={goal} />
          </div>

          <PrimaryButton onClick={onNext} style={{ width: "100%", height: 56, fontSize: 18 }}>
            🚀 Próximo nível
          </PrimaryButton>
        </div>
      </ModalCard>
    </Overlay>
  );
}

export default function CandyGame() {
  const [screen, setScreen] = useState("splash");
  const [level, setLevel] = useState(1);
  const [boardSize, setBoardSize] = useState(getBoardSize(1));
  const [board, setBoard] = useState(createBoard(getBoardSize(1)));
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(getMovesByLevel(1));
  const [goal, setGoal] = useState(getGoalByLevel(1, getBoardSize(1)));
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
  const soundRef = useRef(sound);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      const savedLevel = saved.level || 1;
      const savedSize = getBoardSize(savedLevel);
      setLevel(savedLevel);
      setBoardSize(savedSize);
      setVolume(saved.volume ?? 0.4);
      setIsMuted(saved.isMuted ?? false);
      setGoal(getGoalByLevel(savedLevel, savedSize));
      setMoves(getMovesByLevel(savedLevel));
      setBoard(createBoard(savedSize));
    }
  }, []);

  useEffect(() => {
    saveGame({ level, volume, isMuted });
  }, [level, volume, isMuted]);

  useEffect(() => {
    const finalVolume = isMuted ? 0 : volume;
    soundRef.current?.setVolume(finalVolume);
  }, [volume, isMuted]);

  const showPoints = useCallback((value) => {
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingText({ id, value });
    setTimeout(() => {
      setFloatingText((prev) => (prev?.id === id ? null : prev));
    }, 900);
  }, []);

  const startGame = useCallback(() => {
    const size = getBoardSize(level);
    setBoardSize(size);
    setBoard(createBoard(size));
    setSelected(null);
    setScore(0);
    setMoves(getMovesByLevel(level));
    setGoal(getGoalByLevel(level, size));
    setMatchedCells(new Set());
    setIsPaused(false);
    setShowSettings(false);
    setFloatingText(null);
    setInvalidSwap(null);
    setScreen("game");
  }, [level]);

  const nextLevel = useCallback(() => {
    setLevel((prev) => prev + 1);
    setScreen("splash");
  }, []);

  const quitToSplash = useCallback(() => {
    setShowSettings(false);
    setIsPaused(false);
    setScreen("splash");
  }, []);

  const isAdjacent = useCallback((a, b) => {
    return (
      (Math.abs(a.row - b.row) === 1 && a.col === b.col) ||
      (Math.abs(a.col - b.col) === 1 && a.row === b.row)
    );
  }, []);

  const resolveBoard = useCallback(
    async (startingBoard) => {
      let working = cloneBoard(startingBoard);
      let chain = 0;

      while (true) {
        const { matchedPositions, total, bonusSpecials } = getMatches(working);
        if (matchedPositions.size === 0) break;

        chain += 1;
        const expanded = new Set(matchedPositions);

        bonusSpecials.forEach((bonus) => {
          if (bonus.special === "line") {
            for (let c = 0; c < working.length; c++) expanded.add(`${bonus.row}-${c}`);
            for (let r = 0; r < working.length; r++) expanded.add(`${r}-${bonus.col}`);
          }
          if (bonus.special === "cross") {
            for (let c = 0; c < working.length; c++) expanded.add(`${bonus.row}-${c}`);
            for (let r = 0; r < working.length; r++) expanded.add(`${r}-${bonus.col}`);
          }
        });

        setMatchedCells(new Set(expanded));
        soundRef.current?.play("match");

        const gained = (total + expanded.size - matchedPositions.size) * 30 * chain;
        setScore((prev) => prev + gained);
        showPoints(`+${gained}`);

        await new Promise((resolve) => setTimeout(resolve, CLEAR_MS));

        const cleared = cloneBoard(working);
        expanded.forEach((key) => {
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
    },
    [showPoints]
  );

  const tryMove = useCallback(
    async (from, to) => {
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
    },
    [moves, isBusy, isPaused, screen, board, resolveBoard, isAdjacent]
  );

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

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = async (row, col) => {
    if (!draggingFrom) return;
    await tryMove(draggingFrom, { row, col });
  };

  const handleDragEnd = () => setDraggingFrom(null);

  useEffect(() => {
    if (score >= goal && screen === "game") {
      soundRef.current?.play("win");
      setScreen("win");
      setIsPaused(false);
      setShowSettings(false);
    }
  }, [score, goal, screen]);

  const boardPixelWidth = boardSize * 48 + (boardSize - 1) * 8 + 36;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #8f7cff 0%, #6c63ff 35%, #4b2d7f 100%)",
        fontFamily: "Inter, Arial, sans-serif",
        padding: 20,
        boxSizing: "border-box",
        position: "relative",
        overflowX: "hidden",
        overflowY: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(10px) scale(0.8); }
          20% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-45px) scale(1.1); }
        }
      `}</style>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -80,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.11)",
            filter: "blur(20px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -60,
            width: 240,
            height: 240,
            borderRadius: "50%",
            background: "rgba(255,182,107,0.18)",
            filter: "blur(24px)",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 25,
          width: 52,
          height: 52,
          borderRadius: 18,
          background: "rgba(255,255,255,0.16)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 10px 20px rgba(0,0,0,0.18)",
          fontSize: 24,
        }}
        onClick={() => setShowSettings((prev) => !prev)}
      >
        ⚙️
      </div>

      {showSettings && (
        <Overlay onClose={() => setShowSettings(false)}>
          <SettingsPanel
            level={level}
            goal={goal}
            volume={volume}
            setVolume={setVolume}
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            screen={screen}
            onRestart={startGame}
            onQuit={quitToSplash}
            onClose={() => setShowSettings(false)}
          />
        </Overlay>
      )}

      {screen === "splash" && <SplashScreen onStart={startGame} savedLevel={level} />}

      {screen === "game" && (
        <div style={{ width: "100%", maxWidth: Math.max(470, boardPixelWidth), position: "relative" }}>
          <TopBar score={score} moves={moves} goal={goal} level={level} />

          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            {floatingText && (
              <div
                style={{
                  position: "absolute",
                  top: -20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  color: "#fff7a6",
                  fontWeight: 900,
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
                gridTemplateColumns: `repeat(${boardSize}, 48px)`,
                gap: 8,
                padding: 18,
                borderRadius: 28,
                background: "rgba(255,255,255,0.17)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 18px 40px rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.16)",
                justifyContent: "center",
                position: "relative",
                width: "fit-content",
                margin: "0 auto",
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const key = `${r}-${c}`;
                  const isSelected = selected?.row === r && selected?.col === c;
                  const isMatched = matchedCells.has(key);
                  const isInvalidFrom =
                    invalidSwap?.from?.row === r && invalidSwap?.from?.col === c;
                  const isInvalidTo = invalidSwap?.to?.row === r && invalidSwap?.to?.col === c;

                  let transform = isMatched
                    ? "scale(0.72) rotate(6deg)"
                    : isPaused
                    ? "scale(0.98)"
                    : "scale(1)";

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
                        transform,
                        opacity: isMatched ? 0.2 : 1,
                        transition: `transform ${CLEAR_MS}ms ease, opacity ${CLEAR_MS}ms ease, box-shadow ${CLEAR_MS}ms ease, background 160ms ease`,
                        cursor: isPaused ? "default" : "grab",
                        userSelect: "none",
                        fontSize: 26,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          filter: isMatched ? "blur(1px)" : "none",
                          transform: isMatched ? "scale(1.2)" : "scale(1)",
                          transition: `transform ${CLEAR_MS}ms ease, filter ${CLEAR_MS}ms ease`,
                        }}
                      >
                        {cell.special === "line" ? `✨${cell.symbol}` : cell.special === "cross" ? `💥${cell.symbol}` : cell.symbol}
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
                    borderRadius: 28,
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
        </div>
      )}

      {screen === "win" && <WinScreen level={level} score={score} goal={goal} onNext={nextLevel} />}
    </div>
  );
}
