import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, Loader2, Mail, AlertCircle, Eye, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Task } from '../types';
import { apiFetch } from '../apiInterceptor';
import { db } from '../firebase';
import { buildProgressEmailContent, buildReplyAllDraft, extractEmailAddresses, filterSircloCcEmails } from '../utils/emailReply';

interface ReplyAllEmailModalProps {
  isOpen: boolean;
  task: Task | null;
  assigneeName?: string;
  triggerSource: 'assign' | 'manual';
  currentUserName: string;
  onClose: () => void;
  onSent?: (sentAtIso: string) => void;
}

export default function ReplyAllEmailModal({
  isOpen,
  task,
  assigneeName,
  triggerSource,
  currentUserName,
  onClose,
  onSent
}: ReplyAllEmailModalProps) {
  const [subject, setSubject] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [excludedExternalCc, setExcludedExternalCc] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [picName, setPicName] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [customPlainBody, setCustomPlainBody] = useState('');
  const [isPlainManuallyEdited, setIsPlainManuallyEdited] = useState(false);
  const [previewTab, setPreviewTab] = useState<'preview' | 'plain'>('preview');
  const [forceFallback, setForceFallback] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      const draft = buildReplyAllDraft(task, assigneeName);
      setSubject(draft.subject);
      setTo(draft.to);
      setCc(draft.cc);
      setExcludedExternalCc(draft.excludedExternalCc);
      setRecipientName(draft.recipientName);
      setPicName(draft.picName);
      setCustomNote('');
      setCustomPlainBody(draft.body);
      setIsPlainManuallyEdited(false);
      setPreviewTab('preview');
      setForceFallback(!task.email_thread_id);
      setErrorMessage(null);
    }
  }, [isOpen, task, assigneeName]);

  const generatedContent = useMemo(() => {
    if (!task) return { htmlBody: '', plainBody: '' };
    return buildProgressEmailContent({
      task,
      recipientName,
      picName,
      customNote
    });
  }, [task, recipientName, picName, customNote]);

  const effectivePlainBody = isPlainManuallyEdited ? customPlainBody : generatedContent.plainBody;

  if (!isOpen || !task) return null;

  const hasThreadId = Boolean(task.email_thread_id?.trim());
  const displayId = task.display_id || `IC-${task.id}`;
  const contextLabel =
    triggerSource === 'assign' && assigneeName
      ? `Assignee diperbarui ke ${assigneeName}`
      : 'Balas Email Manual';

  const handleSendReplyAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!subject.trim()) {
      setErrorMessage('Sub Email tidak boleh kosong.');
      return;
    }
    if (!effectivePlainBody.trim()) {
      setErrorMessage('Isi pesan balasan tidak boleh kosong.');
      return;
    }
    const toEmails = extractEmailAddresses(to);
    const sanitizedCcList = filterSircloCcEmails(cc, toEmails);
    const sanitizedCc = sanitizedCcList.join(', ');
    if (sanitizedCc !== cc.trim()) {
      setCc(sanitizedCc);
    }

    if ((!hasThreadId || forceFallback) && !to.trim() && !sanitizedCc) {
      setErrorMessage('Minimal satu alamat penerima pada To atau CC (@sirclo.com) harus diisi.');
      return;
    }

    setIsSending(true);
    try {
      const response = await apiFetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replyAllEmail',
          threadId: task.email_thread_id || '',
          to: to.trim(),
          cc: sanitizedCc,
          subject: subject.trim(),
          body: effectivePlainBody,
          htmlBody: generatedContent.htmlBody,
          forceFallback
        })
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result || result.status !== 'success') {
        const msg = result?.message || result?.error || 'Gagal mengirim Reply All melalui Google Apps Script.';
        throw new Error(msg);
      }

      const modeText =
        result.mode === 'gmail_thread_reply_all'
          ? 'Thread Gmail Reply (@sirclo.com CC)'
          : 'Fallback Daftar Penerima (To & @sirclo.com CC)';

      const sentAtIso = new Date().toISOString();

      try {
        await addDoc(collection(db, 'activity_log'), {
          task_id: String(task.id),
          user: currentUserName || 'System',
          action: 'Sent Email Reply All',
          details: `Subject: ${subject.trim()}\nTo: ${to.trim() || '-'}\nCC: ${sanitizedCc || '-'}\nMode: ${modeText}`,
          created_at: serverTimestamp()
        });
      } catch (logErr) {
        console.warn('Failed to write activity log for email reply all:', logErr);
      }

      try {
        await updateDoc(doc(db, 'tasks', String(task.id)), {
          email_reply_all_sent_at: sentAtIso,
          updated_at: serverTimestamp()
        });
      } catch (updateErr) {
        console.warn('Failed to update email_reply_all_sent_at:', updateErr);
      }

      toast.success(
        result.mode === 'gmail_thread_reply_all'
          ? 'Reply All berhasil dikirim ke thread email.'
          : 'Reply All berhasil dikirim ke daftar penerima (To & CC).'
      );
      onSent?.(sentAtIso);
      onClose();
    } catch (err: any) {
      const message = err?.message || 'Terjadi kesalahan saat mengirim email.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isSending && onClose()}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                  Konfirmasi Reply All Email
                </h3>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)] truncate">
                <span className="font-mono">{displayId}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{contextLabel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors disabled:opacity-50 shrink-0"
              aria-label="Tutup konfirmasi email"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form id="reply-all-email-form" onSubmit={handleSendReplyAll} className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Delivery Route Info */}
            <div className="pb-3 border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)] flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--text-primary)]">Jalur Pengiriman:</span>
                <span>
                  {hasThreadId && !forceFallback
                    ? 'Thread Gmail Asli (otomatis fallback ke To & CC bila akun berbeda)'
                    : 'Daftar Penerima Email (To & CC)'}
                </span>
              </div>
              {hasThreadId && (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={forceFallback}
                    onChange={(e) => setForceFallback(e.target.checked)}
                    className="rounded border-[var(--border-color)] text-[var(--accent-color)] focus:ring-[var(--border-focus)]"
                  />
                  <span>Kirim langsung sesuai daftar To &amp; CC di bawah (mode fallback langsung)</span>
                </label>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-md border border-[var(--danger-color)] bg-[var(--badge-danger-bg)] text-[var(--danger-color)] text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                Sub Email
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSending}
                placeholder="Re: Subjek email..."
                className="w-full px-3 py-2 text-sm border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  To (Pengirim / From Asli)
                </label>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={isSending}
                  placeholder="pengirim@domain.com"
                  className="w-full px-3 py-2 text-xs font-mono border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  CC (To Asli &amp; CC Asli · Khusus @sirclo.com)
                </label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  disabled={isSending}
                  placeholder="tim@sirclo.com, pic@sirclo.com"
                  className="w-full px-3 py-2 text-xs font-mono border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                />
                <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-snug">
                  {excludedExternalCc.length > 0
                    ? `Email di luar @sirclo.com otomatis di-takeout dari CC: ${excludedExternalCc.join(', ')}`
                    : 'Hanya email dengan domain @sirclo.com yang disertakan di CC.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  Nama Sapaan (Kepada Yth.)
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  disabled={isSending}
                  placeholder="Nama requestor"
                  className="w-full px-3 py-2 text-sm border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  PIC (Assignee)
                </label>
                <input
                  type="text"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  disabled={isSending}
                  placeholder="Nama PIC yang memproses"
                  className="w-full px-3 py-2 text-sm border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                rows={2}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                disabled={isSending}
                placeholder="Tambahkan pesan khusus jika diperlukan (akan tampil di bawah status)..."
                className="w-full px-3 py-2 text-sm border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] leading-relaxed"
              />
            </div>

            {/* Email Preview / Plain Text Fallback */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Isi Pesan Balasan
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('preview')}
                    className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      previewTab === 'preview'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPlainManuallyEdited) {
                        setCustomPlainBody(generatedContent.plainBody);
                      }
                      setPreviewTab('plain');
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      previewTab === 'plain'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Teks Plain</span>
                  </button>
                </div>
              </div>

              {previewTab === 'preview' ? (
                <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md overflow-x-auto">
                  <div
                    className="mx-auto"
                    dangerouslySetInnerHTML={{ __html: generatedContent.htmlBody }}
                  />
                </div>
              ) : (
                <textarea
                  rows={10}
                  value={effectivePlainBody}
                  onChange={(e) => {
                    setCustomPlainBody(e.target.value);
                    setIsPlainManuallyEdited(true);
                  }}
                  disabled={isSending}
                  className="w-full px-3 py-2 text-xs font-mono border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] leading-relaxed"
                />
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] rounded transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {triggerSource === 'assign' ? 'Lewati' : 'Batal'}
            </button>
            <button
              type="submit"
              form="reply-all-email-form"
              disabled={isSending}
              className="px-4 py-2 btn-primary text-sm font-medium rounded transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isSending ? 'Mengirim...' : 'Kirim Reply All'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
