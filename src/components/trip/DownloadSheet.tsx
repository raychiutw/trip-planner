import React, { useState, useCallback } from 'react';
import { apiFetch } from '../../hooks/useApi';
import Icon from '../shared/Icon';

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
    } catch (e) {
      alert('下載失敗，請稍後再試');
    } finally {
      setLoading(null);
    }
  }, [tripId, fileBase, downloadBlob]);

  const handleMarkdown = useCallback(async () => {
    setLoading('md');
    try {
      const [meta, daySummaries] = await Promise.all([
        apiFetch<any>(`/trips/${tripId}`),
        apiFetch<any[]>(`/trips/${tripId}/days`),
      ]);

      let md = `# ${meta.name || tripName}\n\n`;
      if (meta.title) md += `${meta.title}\n\n`;

      for (const ds of daySummaries) {
        const dayData = await apiFetch<any>(`/trips/${tripId}/days/${ds.day_num}`);
        md += `## Day ${ds.day_num}`;
        if (ds.label) md += ` ${ds.label}`;
        if (ds.date) md += ` — ${ds.date}`;
        md += '\n\n';

        if (dayData.hotel?.name) {
          md += `**住宿：** ${dayData.hotel.name}\n\n`;
        }

        if (dayData.entries) {
          for (const entry of dayData.entries) {
            md += `### ${entry.time || ''} ${entry.title || ''}\n`;
            if (entry.rating) md += `⭐ ${entry.rating}`;
            if (entry.travel_mode && entry.travel_duration) {
              md += ` · ${entry.travel_mode} ${entry.travel_duration}分鐘`;
            }
            md += '\n';
            if (entry.restaurants && entry.restaurants.length > 0) {
              md += '\n**餐廳推薦：**\n';
              for (const r of entry.restaurants) {
                md += `- ${r.name}`;
                if (r.rating) md += ` ⭐${r.rating}`;
                if (r.price) md += ` · ${r.price}`;
                md += '\n';
              }
            }
            md += '\n';
          }
        }
      }

      downloadBlob(md, `${fileBase}.md`, 'text/markdown');
    } catch (e) {
      alert('下載失敗，請稍後再試');
    } finally {
      setLoading(null);
    }
  }, [tripId, tripName, fileBase, downloadBlob]);

  const handleCSV = useCallback(async () => {
    setLoading('csv');
    try {
      const daySummaries = await apiFetch<any[]>(`/trips/${tripId}/days`);

      const rows: string[][] = [['Day', '日期', '時間', '地點', '評分', '交通方式', '交通時間(分鐘)', '備註']];

      for (const ds of daySummaries) {
        const dayData = await apiFetch<any>(`/trips/${tripId}/days/${ds.day_num}`);
        if (dayData.entries) {
          for (const entry of dayData.entries) {
            rows.push([
              String(ds.day_num),
              ds.date || '',
              entry.time || '',
              entry.title || '',
              entry.rating ? String(entry.rating) : '',
              entry.travel_mode || '',
              entry.travel_duration ? String(entry.travel_duration) : '',
              entry.note || '',
            ]);
          }
        }
      }

      const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
      // Add BOM for Excel UTF-8
      downloadBlob('\uFEFF' + csv, `${fileBase}.csv`, 'text/csv;charset=utf-8');
    } catch (e) {
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
