'use client';

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type TaskResult = {
  timestamp: string;
  score: number;
  image_data: string;
};

type TaskStatusResponse = {
  status: string;
  filename?: string;
  progress?: number | null;
  results?: TaskResult[];
  error?: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const handleDownloadResult = useCallback(
    (result: TaskResult, index: number) => {
      if (!result.image_data) {
        return;
      }

      const baseName = filename?.replace(/\.[^/.]+$/, "") ?? "smile_scene";
      const sanitizedTimestamp = result.timestamp.replace(/[^0-9A-Za-z_-]+/g, "");
      const downloadName = sanitizedTimestamp
        ? `${baseName}_${sanitizedTimestamp}`
        : `${baseName}_${String(index + 1).padStart(2, "0")}`;

      const link = document.createElement("a");
      link.href = result.image_data;
      link.download = `${downloadName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [filename],
  );

  const resetState = useCallback(() => {
    setTaskId(null);
    setStatus("idle");
    setProgress(null);
    setResults([]);
    setError(null);
    setFilename(null);
  }, []);

  const handleFileSelect = useCallback((file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setFilename(file.name);
      setError(null);
      setResults([]);
      setProgress(null);
      setStatus("idle");
    } else {
      resetState();
    }
  }, [resetState]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      return;
    }

    setError(null);
    setStatus("uploading");
    setProgress(0);
    setResults([]);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "アップロードに失敗しました。");
      }

      const data: TaskStatusResponse & { task_id: string } = await response.json();
      setTaskId(data.task_id);
      setStatus(data.status ?? "processing");
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "アップロード中に不明なエラーが発生しました。";
      setError(message);
      setStatus("error");
    }
  }, [selectedFile]);

  useEffect(() => {
    if (!taskId || status !== "processing") {
      return;
    }

    let isMounted = true;
    let intervalId: number | null = null;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
        if (!response.ok) {
          throw new Error("解析状況の取得に失敗しました。");
        }

        const data: TaskStatusResponse = await response.json();

        if (!isMounted) {
          return;
        }

        setStatus(data.status ?? "processing");
        setProgress(
          typeof data.progress === "number" && data.progress >= 0
            ? Math.min(100, Math.max(0, data.progress))
            : null,
        );
        setResults(Array.isArray(data.results) ? data.results : []);
        setFilename((prev) => data.filename ?? prev);

        if (data.error) {
          setError(data.error);
        }

        if (data.status === "complete" || data.status === "error") {
          if (intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "解析状況の取得中に不明なエラーが発生しました。";
        setError(message);
        setStatus("error");
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    fetchStatus();
    intervalId = window.setInterval(fetchStatus, 2000);

    return () => {
      isMounted = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [taskId, status]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "idle":
        return "準備中";
      case "uploading":
        return "アップロード中";
      case "processing":
        return "解析中";
      case "complete":
        return "解析完了";
      case "error":
        return "エラー";
      default:
        return status;
    }
  }, [status]);

  const canSubmit = useMemo(() => {
    if (!selectedFile) {
      return false;
    }
    return status === "idle" || status === "complete" || status === "error";
  }, [selectedFile, status]);

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start w-full max-w-4xl">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            動画ファイルをアップロードすると、バックエンドが笑顔シーンを解析します。
          </li>
          <li className="tracking-[-.01em]">
            解析が完了すると、抽出できたシーンが下部に表示されます。
          </li>
        </ol>

        <section className="w-full rounded-3xl border border-black/[.08] dark:border-white/[.145] bg-white/70 dark:bg-black/40 backdrop-blur p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-[-.01em] mb-4 text-center sm:text-left">
            動画アップロード
          </h2>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleUpload();
            }}
          >
            <div className="flex flex-col gap-2">
              <label
                htmlFor="video-upload"
                className="text-sm font-medium tracking-[-.01em] text-foreground/80"
              >
                動画ファイル
              </label>
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                className="rounded-xl border border-black/[.08] dark:border-white/[.145] px-3 py-2 text-sm bg-transparent file:mr-4 file:rounded-lg file:border-0 file:bg-foreground file:px-3 file:py-1 file:text-background file:font-medium"
                onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
              />
              {filename && (
                <p className="text-xs text-foreground/60 tracking-[-.01em]">
                  選択中: {filename}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            >
              {status === "processing" || status === "uploading"
                ? "処理中..."
                : "解析を開始"}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3 text-sm tracking-[-.01em]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-foreground/70">
              <span className="font-medium">ステータス</span>
              <span>{statusLabel}</span>
            </div>
            {progress !== null && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-foreground/60">
                  <span>進捗</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/[.06] dark:bg-white/[.12] overflow-hidden">
                  <div
                    className="h-full bg-foreground transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </section>

        {results.length > 0 && (
          <section className="w-full rounded-3xl border border-black/[.08] dark:border-white/[.145] bg-white/70 dark:bg-black/40 backdrop-blur p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-[-.01em] mb-4 text-center sm:text-left">
              抽出された笑顔シーン
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {results.map((result, index) => (
                <figure
                  key={`${result.timestamp}-${index}`}
                  className="flex flex-col gap-3 rounded-2xl border border-black/[.06] dark:border-white/[.1] bg-white/50 dark:bg-black/50 p-4"
                >
                  <img
                    src={result.image_data}
                    alt={`${result.timestamp} の笑顔シーン`}
                    className="w-full rounded-xl object-cover"
                  />
                  <figcaption className="text-sm text-foreground/70 tracking-[-.01em]">
                    <div className="space-y-1">
                      <div>タイムスタンプ: {result.timestamp}</div>
                      <div>スコア: {result.score.toFixed(2)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadResult(result, index)}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/[.08] dark:border-white/[.145] px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]"
                    >
                      ダウンロード
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center text-sm text-foreground/70">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          API ドキュメント
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="http://localhost:8000/health"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          ヘルスチェック
        </a>
      </footer>
    </div>
  );
}
