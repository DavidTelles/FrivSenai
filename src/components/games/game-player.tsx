"use client";

import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
import { countView } from "@/app/actions";
import { EXTERNAL_GAME_SANDBOX, HOSTED_GAME_SANDBOX } from "@/lib/games/sandbox";

type Props = {
  gameId: string;
  title: string;
  sourceType: "zip" | "url";
  entryPath: string | null;
  externalUrl: string | null;
  embedStatus: "embeddable" | "blocked";
};

const LOAD_TIMEOUT_MS = 30_000;
const VIEWER_KEY = "frivsenai-viewer";

function recordView(gameId: string) {
  let key = localStorage.getItem(VIEWER_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(VIEWER_KEY, key);
  }
  startTransition(() => countView(gameId, key));
}

export function GamePlayer({ gameId, title, sourceType, entryPath, externalUrl, embedStatus }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "slow" | "error">("idle");

  const src = sourceType === "zip" ? `/play/${gameId}/${entryPath}` : externalUrl;
  const started = status !== "idle";

  useEffect(() => {
    recordView(gameId);
  }, [gameId]);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setStatus("slow"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, run]);

  const start = async () => {
    setStatus("loading");
    setRun((value) => value + 1);
    if (sourceType === "zip" && src) {
      const check = await fetch(src, { method: "GET" }).catch(() => null);
      if (!check?.ok) setStatus("error");
    }
  };

  if (embedStatus === "blocked" && externalUrl) {
    return (
      <div className="tile p-8 text-center">
        <h2 className="font-display text-xl font-bold">This game cannot run inside FrivSenai</h2>
        <p className="mt-2 text-muted">The site hosting it does not allow embedding.</p>
        <a className="btn btn-primary mt-4" href={externalUrl} target="_blank" rel="noopener noreferrer nofollow">
          Open on the original site
        </a>
      </div>
    );
  }

  return (
    <section aria-label={`${title} game`}>
      <div ref={stage} className="relative mx-auto aspect-video max-h-[75dvh] w-full overflow-hidden rounded-2xl border-2 border-line bg-ink">
        {!started && (
          <div className="absolute inset-0 grid place-items-center">
            <button className="btn btn-sun px-8 py-3 text-lg" onClick={start}>
              Play {title}
            </button>
          </div>
        )}
        {status === "error" && (
          <div role="alert" className="absolute inset-0 z-10 grid place-items-center bg-ink p-6 text-center text-white">
            <div>
              <p className="font-bold">The game could not be loaded.</p>
              <button className="btn mt-3 text-ink" onClick={start}>
                Try again
              </button>
            </div>
          </div>
        )}
        {status === "slow" && (
          <p role="status" className="absolute left-2 top-2 z-10 rounded bg-sun px-2 py-1 text-xs font-semibold">
            Still loading. The game may be unavailable.
          </p>
        )}
        {started && src && status !== "error" && (
          <iframe
            key={run}
            src={src}
            title={title}
            sandbox={sourceType === "zip" ? HOSTED_GAME_SANDBOX : EXTERNAL_GAME_SANDBOX}
            allow="autoplay; gamepad"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full bg-white"
            onLoad={() => setStatus((current) => (current === "error" ? current : "ready"))}
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/games" className="btn">
          Back to catalog
        </Link>
        <button className="btn" onClick={start} disabled={!started}>
          Restart
        </button>
        <button className="btn" onClick={() => stage.current?.requestFullscreen()} disabled={!started}>
          Fullscreen
        </button>
      </div>
    </section>
  );
}
