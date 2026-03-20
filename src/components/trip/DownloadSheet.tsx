import React, { useState, useCallback } from 'react';
import { apiFetch } from '../../hooks/useApi';
import Icon from '../shared/Icon';

async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function next(): Promise<void> {
    const idx = i++;
    if (idx >= items.length) return;
    results[idx] = await fn(items[idx]);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

interface DownloadSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
}

export default function DownloadSheet({ isOpen, onClose, tripId, tripName }: DownloadSheetProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const fileBase = `${tripName}-${today}`;

  const downloadBlob = useCallback((content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handlePDF = useCallback(() => {
    onClose();
    setTimeout(() => window.print(), 300);
  }, [onClose]);

  const handleJSON = useCallback(async () => {
    setLoading('json');
    try {
      const [meta, days] = await Promise.all([
        apiFetch(`/trips/${tripId}`),
        apiFetch(`/trips/${tripId}/days`),
      ]);
      const data = { meta, days };
      downloadBlob(JSON.stringify(data, null, 2), `${fileBase}.json`, 'application/json');
    } catch {
      alert('下載失敗，請稍後再試');
    } finally {
      setLoading(null);
    }
  }, [tripId, fileBase, downloadBlob]);

  const handleMarkdown = useCallback(async () => {
    setLoading('md');
    try {
      type DaySummary = Record<string, unknown> & { day_num: number; label?: string; date?: string };
      type DayData = Record<string, unknown> & {
        hotel?: Record<string, unknown> | null;
        entries?: Array<Record<string, unknown> & { restaurants?: Array<Record<string, unknown>> }>;
      };

      const [meta, daySummaries] = await Promise.all([
        apiFetch<Record<string, unknown>>(`/trips/${tripId}`),
        apiFetch<DaySummary[]>(`/trips/${tripId}/days`),
      ]);

      let md = `# ${String(meta.name || tripName)}\n\n`;
      if (meta.title) md += `${String(meta.title)}\n\n`;

      const allDayData = await pMap(
        daySummaries,
        ds => apiFetch<DayData>(`/trips/${tripId}/days/${ds.day_num}`),
        5,
      );
      for (let i = 0; i < daySummaries.length; i++) {
        const ds = daySummaries[i];
        const dayData = allDayData[i];
        md += `## Day ${ds.day_num}`;
        if (ds.label) md += ` ${String(ds.label)}`;
        if (ds.date) md += ` — ${String(ds.date)}`;
        md += '\n\n';

        if (dayData.hotel && typeof dayData.hotel === 'object' && dayData.hotel.name) {
          md += `**住宿：** ${String(dayData.hotel.name)}\n\n`;
        }

        if (dayData.entries) {
          for (const entry of dayData.entries) {
            md += `### ${String(entry.time || '')} ${String(entry.title || '')}\n`;
            if (entry.rating) md += `⭐ ${String(entry.rating)}`;
            if (entry.travel_mode && entry.travel_duration) {
              md += ` · ${String(entry.travel_mode)} ${String(entry.travel_duration)}分鐘`;
            }
            md += '\n';
            if (entry.restaurants && entry.restaurants.length > 0) {
              md += '\n**餐廳推薦：**\n';
              for (const r of entry.restaurants) {
                md += `- ${String(r.name || '')}`;
                if (r.rating) md += ` ⭐${String(r.rating)}`;
                if (r.price) md += ` · ${String(r.price)}`;
                md += '\n';
              }
            }
            md += '\n';
          }
        }
      }

      downloadBlob(md, `${fileBase}.md`, 'text/markdown');
    } catch {
      alert('下載失敗，請稍後再試');
    } finally {
      setLoading(null);
    }
  }, [tripId, tripName, fileBase, downloadBlob]);

  const handleCSV = useCallback(async () => {
    setLoading('csv');
    try {
      type DaySummary = Record<string, unknown> & { day_num: number; date?: string };
      type DayData = Record<string, unknown> & {
        entries?: Array<Record<string, unknown>>;
      };

      const daySummaries = await apiFetch<DaySummary[]>(`/trips/${tripId}/days`);

      const rows: string[][] = [['Day', '日期', '時間', '地點', '評分', '交通方式', '交通時間(分鐘)', '備註']];

      const allDayData = await pMap(
        daySummaries,
        ds => apiFetch<DayData>(`/trips/${tripId}/days/${ds.day_num}`),
        5,
      );
      for (let i = 0; i < daySummaries.length; i++) {
        const ds = daySummaries[i];
        const dayData = allDayData[i];
        if (dayData.entries) {
          for (const entry of dayData.entries) {
            rows.push([
              String(ds.day_num),
              String(ds.date || ''),
              String(entry.time || ''),
              String(entry.title || ''),
              entry.rating ? String(entry.rating) : '',
              String(entry.travel_mode || ''),
              entry.travel_duration ? String(entry.travel_duration) : '',
              String(entry.note || ''),
            ]);
          }
        }
      }

      const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
      // Add BOM for Excel UTF-8
      downloadBlob('\uFEFF' + csv, `${fileBase}.csv`, 'text/csv;charset=utf-8');
    } catch {
      alert('下載失敗，請稍後再試');
    } finally {
      setLoading(null);
    }
  }, [tripId, fileBase, downloadBlob]);

  if (!isOpen) return null;

  const options = [
    { key: 'pdf', label: 'PDF（含排版）', icon: 'printer', handler: handlePDF },
    { key: 'md', label: 'Markdown（純文字）', icon: 'doc', handler: handleMarkdown },
    { key: 'json', label: 'JSON（結構化資料）', icon: 'code', handler: handleJSON },
    { key: 'csv', label: 'CSV（表格格式）', icon: 'table', handler: handleCSV },
  ];

  return (
    <>
      <div className="download-backdrop" onClick={onClose} />
      <div className="download-sheet">
        <div className="download-sheet-handle" />
        <div className="download-sheet-title">下載行程</div>
        <div className="download-sheet-options">
          {options.map(opt => (
            <button
              key={opt.key}
              className="download-option"
              onClick={opt.handler}
              disabled={loading !== null}
            >
              <Icon name={opt.icon} />
              <span>{opt.label}</span>
              {loading === opt.key && <span className="download-spinner" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
