'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Script from "next/script";

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

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : "";

  return (
    <>
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "niko-clip",
            "description": "動画から笑顔を自動抽出できる無料ツール。AIが動画を解析して笑顔の瞬間を見つけ出します。",
            "url": baseUrl,
            "applicationCategory": "MultimediaApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "JPY"
            },
            "featureList": [
              "動画から笑顔を自動抽出",
              "AIによる笑顔スコア算出",
              "サムネイル画像の生成",
              "SNS向け素材の作成"
            ],
          })
        }}
      />
      <Script
        id="faq-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "動画から笑顔を抽出する方法は？",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "動画ファイルを選択して「解析を開始」ボタンを押すだけです。AIが自動で動画を解析し、笑顔が映っているシーンを検出して抽出します。"
                }
              },
              {
                "@type": "Question",
                "name": "どんな動画形式に対応していますか？",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "MP4、MOV、AVIなどの一般的な動画形式に対応しています。"
                }
              },
              {
                "@type": "Question",
                "name": "笑顔の抽出精度はどのくらいですか？",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "AIが笑顔スコアを算出するため、明るい表情や自然な笑顔を高精度で検出できます。スコアが高い順に並ぶので、最も映えるシーンを迷わず選べます。"
                }
              }
            ]
          })
        }}
      />
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-amber-50 via-white to-sky-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.22),_transparent_52%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-12 mx-auto h-32 max-w-5xl rounded-full bg-white/60 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-lg font-semibold tracking-tight text-amber-500 shadow-lg shadow-amber-200/40 ring-1 ring-amber-100">
              😊
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-900">niko-clip</p>
              <p className="text-xs text-slate-500">みんなの笑顔を切り取るクリップメーカー</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 pb-16 sm:px-10 lg:pb-24">
          <section className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]" id="upload">
            <div className="flex flex-col justify-center gap-10">
              <div className="space-y-6">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                  動画から笑顔を抽出 - AIが自動で笑顔シーンを見つけます
                </h1>
                <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                  <strong>niko-clipは動画から笑顔を自動抽出する無料ツール</strong>です。動画をアップロードするだけで、AIが笑顔の瞬間を検出してサムネイルやSNS向けの画像素材を生成。イベント動画やVlogから最高に盛り上がった瞬間だけをサクッと抽出し、サムネ・ショート動画・リール用にぴったりの素材が秒で手に入ります。
                </p>
              </div>

              <div className="grid gap-5 text-sm text-slate-600" id="features">
                <div className="flex items-center gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-[0_20px_60px_rgba(148,163,184,0.25)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-base font-semibold text-amber-600">
                    1
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">動画をドロップするだけ</h3>
                    <p>撮りたて動画でもOK。アップロードと同時に解析がスタートします。</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-[0_20px_60px_rgba(148,163,184,0.18)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-base font-semibold text-sky-600">
                    2
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">笑顔ゲージでベストを選抜</h3>
                    <p>笑顔スコア付きで並ぶから、映える表情を迷わずピックできます。</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-[0_20px_60px_rgba(148,163,184,0.12)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-base font-semibold text-emerald-600">
                    3
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">SNS映えする素材が完成</h3>
                    <p>ダウンロードした画像は、そのままサムネやショートのカバーに使えます。</p>
                  </div>
                </div>
              </div>
            </div>

            <section className="flex h-full flex-col justify-between rounded-3xl bg-white/80 p-6 shadow-[0_24px_60px_rgba(148,163,184,0.35)] backdrop-blur-lg sm:p-7">
              <div className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">アップロードして笑顔を切り取り</h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  ファイルを選択して「解析を開始」を押すと、笑顔シーンを自動抽出します。
                </p>
              </div>

          <form
                className="mt-6 flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              handleUpload();
            }}
          >
                <div className="flex flex-col gap-3">
              <label
                htmlFor="video-upload"
                    className="text-sm font-medium text-slate-800"
              >
                動画ファイル
              </label>
                  <div className="relative">
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white file:font-semibold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
              />
              {filename && (
                      <p className="mt-2 text-xs text-slate-500">
                  選択中: {filename}
                </p>
              )}
                  </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 via-rose-400 to-sky-400 px-5 text-sm font-semibold text-white shadow-lg shadow-rose-200/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-rose-200/70 disabled:translate-y-0 disabled:opacity-50"
            >
              {status === "processing" || status === "uploading"
                    ? "解析中..."
                : "解析を開始"}
            </button>
          </form>

              <div className="mt-8 space-y-4 rounded-2xl border border-slate-100 bg-white/80 p-5 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">現在のステータス</span>
                  <span className="text-slate-900">{statusLabel}</span>
            </div>
            {progress !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>進捗</span>
                  <span>{progress}%</span>
                </div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                  <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-sky-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            {error && (
                  <p className="text-sm text-rose-500">{error}</p>
            )}
          </div>
        </section>
          </section>

          <section className="mx-auto mt-16 max-w-6xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-2xl font-semibold text-slate-900">抽出された笑顔シーン</h2>
              <p className="text-sm text-slate-500">
                解析が終わると、笑顔スコア順にサムネイルを表示します。気に入った瞬間をクリックして保存しましょう。
              </p>
            </div>

            {results.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-12 text-center text-sm text-slate-500">
                まだ解析結果がありません。お気に入りの動画をアップロードして、ハッピーな瞬間を集めましょう。
              </div>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {results.map((result, index) => (
                <figure
                  key={`${result.timestamp}-${index}`}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-[0_18px_50px_rgba(148,163,184,0.28)]"
                >
                    <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={result.image_data}
                    alt={`${result.timestamp} の笑顔シーン`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      <div className="pointer-events-none absolute inset-x-3 -bottom-14 h-28 rounded-3xl bg-white/60 blur-2xl" />
                    </div>
                    <figcaption className="relative flex flex-col gap-3 px-5 pb-5 pt-4 text-sm text-slate-600">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">タイムスタンプ</div>
                        <div>{result.timestamp}</div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">笑顔スコア</div>
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-600">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                          {result.score.toFixed(2)}
                        </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadResult(result, index)}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-slate-300/60 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-300/80"
                    >
                      ダウンロード
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
            )}
          </section>

          <section className="mx-auto mt-20 max-w-6xl">
            <h2 className="mb-8 text-2xl font-semibold text-slate-900">よくある質問</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white/80 p-6 shadow-[0_20px_60px_rgba(148,163,184,0.18)]">
                <h3 className="mb-3 text-lg font-semibold text-slate-900">動画から笑顔を抽出する方法は？</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  動画ファイルを選択して「解析を開始」ボタンを押すだけです。AIが自動で動画を解析し、笑顔が映っているシーンを検出して抽出します。笑顔スコアが高い順に結果が表示されるので、お気に入りのシーンを簡単に見つけられます。
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-6 shadow-[0_20px_60px_rgba(148,163,184,0.18)]">
                <h3 className="mb-3 text-lg font-semibold text-slate-900">どんな動画形式に対応していますか？</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  MP4、MOV、AVIなどの一般的な動画形式に対応しています。撮りたての動画でもOK。アップロードと同時に解析がスタートし、数分で笑顔シーンが抽出されます。
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-6 shadow-[0_20px_60px_rgba(148,163,184,0.18)]">
                <h3 className="mb-3 text-lg font-semibold text-slate-900">笑顔の抽出精度はどのくらいですか？</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  AIが笑顔スコアを算出するため、明るい表情や自然な笑顔を高精度で検出できます。スコアが高い順に並ぶので、最も映えるシーンを迷わず選べます。
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-6 shadow-[0_20px_60px_rgba(148,163,184,0.18)]">
                <h3 className="mb-3 text-lg font-semibold text-slate-900">抽出した画像の使い道は？</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  ダウンロードした画像は、そのままYouTubeのサムネイル、Instagramのリール、TikTokのショート動画のカバー画像として使用できます。SNS映えする素材としてそのまま活用できます。
                </p>
              </div>
            </div>
          </section>
      </main>

        <footer className="mt-auto border-t border-slate-200 bg-white/80 px-6 py-8 text-sm text-slate-500 backdrop-blur">
          <div className="mx-auto flex flex-col items-center justify-between gap-4 sm:flex-row sm:gap-6">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} niko-clip</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                className="transition hover:text-slate-900"
          href={`${API_BASE_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
        >
          API ドキュメント
        </a>
        <a
                className="transition hover:text-slate-900"
          href={`${API_BASE_URL}/health`}
          target="_blank"
          rel="noopener noreferrer"
        >
          ヘルスチェック
        </a>
            </div>
          </div>
      </footer>
      </div>
    </div>
    </>
  );
}
