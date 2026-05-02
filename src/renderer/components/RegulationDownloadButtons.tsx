import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ArticleRecord, RegulationFile } from "../../shared/types";
import { getErrorMessage, unwrap } from "../lib/api";

export function RegulationDownloadButtons({ article, compact = false }: { article: ArticleRecord; compact?: boolean }) {
  const [attachments, setAttachments] = useState<RegulationFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const baseFiles = useMemo<RegulationFile[]>(() => {
    if (!article.seq_history) return [];
    const baseName = article.regulation_name.replace(/[<>:"/\\|?*]/g, "_");
    return [
      {
        fileSeq: article.seq_history,
        fileType: "ori",
        fileName: `${baseName}.hwp`,
        label: "규정 HWP",
      },
      {
        fileSeq: article.seq_history,
        fileType: "oriPdf",
        fileName: `${baseName}.pdf`,
        label: "규정 PDF",
      },
    ];
  }, [article.regulation_name, article.seq_history]);

  useEffect(() => {
    if (compact || !article.seq || !article.seq_history) return;
    let cancelled = false;
    void window.kuRegulation.files
      .attachments(article.seq, article.seq_history)
      .then((result) => {
        if (!cancelled) setAttachments(unwrap(result));
      })
      .catch((error) => {
        if (!cancelled) setMessage(getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [article.seq, article.seq_history, compact]);

  async function download(file: RegulationFile) {
    const key = `${file.fileType}:${file.fileSeq}`;
    setBusyKey(key);
    setMessage(null);
    try {
      const result = unwrap(await window.kuRegulation.files.download(file));
      setMessage(`${result.fileName} 저장을 완료했습니다.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  }

  if (baseFiles.length === 0) return null;

  return (
    <div className="download-block">
      <div className="download-row">
        {[...baseFiles, ...attachments].map((file) => {
          const key = `${file.fileType}:${file.fileSeq}`;
          return (
            <button key={key} type="button" className="secondary download-button" disabled={busyKey !== null} onClick={() => download(file)}>
              <Download size={15} />
              {busyKey === key ? "저장 중..." : file.label}
            </button>
          );
        })}
      </div>
      {attachments.length > 0 && <div className="meta-line">별첨/별표 파일 {attachments.length}개를 찾았습니다.</div>}
      {message && <div className="download-message">{message}</div>}
    </div>
  );
}
