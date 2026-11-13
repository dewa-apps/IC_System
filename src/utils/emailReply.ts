import { Task } from '../types';

export const DASHBOARD_LINK_URL =
  'https://sites.google.com/sirclo.com/ic-queue-dashboard/home?pli=1&authuser=0';

export function hasTaskEmailMetadata(task?: Partial<Task> | null): boolean {
  if (!task) return false;
  return Boolean(
    task.email_thread_id?.trim() ||
    task.email_message_id?.trim() ||
    task.email_subject?.trim() ||
    task.email_from?.trim() ||
    task.email_to?.trim() ||
    task.email_cc?.trim()
  );
}

export function extractEmailAddresses(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw.map(v => String(v || '')) : String(raw).split(/[,;]+/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const angleMatch = trimmed.match(/<([^>]+)>/);
    const emailCandidate = (angleMatch ? angleMatch[1] : trimmed).trim();
    if (!emailCandidate.includes('@')) continue;
    const key = emailCandidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(emailCandidate);
  }

  return result;
}

export function extractRecipientDisplayName(task: Partial<Task>): string {
  const fromRaw = (task.email_from || '').trim();
  if (fromRaw) {
    const match = fromRaw.match(/^(.*?)\s*<[^>]+>/);
    if (match && match[1]) {
      const cleaned = match[1].replace(/["']/g, '').trim();
      if (cleaned) return cleaned;
    }
  }
  const requestor = (task.requestor || '').trim();
  if (requestor && !requestor.includes('@')) {
    return requestor;
  }
  if (fromRaw && fromRaw.includes('@')) {
    const localPart = fromRaw.split('@')[0].replace(/[._-]+/g, ' ').trim();
    if (localPart) {
      return localPart.replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  return 'Bapak/Ibu';
}

export function formatIndonesianDate(dateVal?: string | null): string {
  if (!dateVal) return '-';
  const trimmed = String(dateVal).trim();
  if (!trimmed) return '-';
  try {
    const parsed = new Date(trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00`);
    if (isNaN(parsed.getTime())) return trimmed;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(parsed);
  } catch {
    return trimmed;
  }
}

export function formatReplySubject(task: Partial<Task>): string {
  const baseSubject = (task.email_subject || task.title || 'Task Update').trim();
  if (/^re:/i.test(baseSubject)) {
    return baseSubject;
  }
  return `Re: ${baseSubject}`;
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getPriorityColor = (priority?: string): string => {
  switch ((priority || '').toUpperCase()) {
    case 'URGENT':
      return '#dc2626';
    case 'HIGH':
      return '#ea580c';
    case 'MEDIUM':
      return '#d97706';
    default:
      return '#1a73e8';
  }
};

export interface ProgressEmailTemplateParams {
  task: Partial<Task>;
  recipientName: string;
  picName: string;
  customNote?: string;
}

export function buildProgressEmailContent({
  task,
  recipientName,
  picName,
  customNote
}: ProgressEmailTemplateParams): {
  htmlBody: string;
  plainBody: string;
} {
  const rawDisplayId = (task.display_id || (task.id ? `IC-${task.id}` : 'IC-TASK')).trim();
  const displayIdWithHash = rawDisplayId.startsWith('#') ? rawDisplayId : `#${rawDisplayId}`;
  const subjectEmail = (task.email_subject || task.title || '-').trim();
  const requestDateFormatted = formatIndonesianDate(task.request_date);
  const dueDateFormatted = formatIndonesianDate(task.due_date);
  const statusText = (task.status || 'TODO').trim();
  const priorityText = (task.priority || 'LOW').toUpperCase();
  const priorityBg = getPriorityColor(priorityText);
  const picDisplay = (picName || task.assignee || 'Belum ditentukan').trim() || 'Belum ditentukan';
  const greetingName = (recipientName || 'Bapak/Ibu').trim();
  const noteTrimmed = (customNote || '').trim();

  const noteHtml = noteTrimmed
    ? `<p style="margin: 14px 0 0 0; font-size: 14px; line-height: 1.6; color: #1f2937;">${escapeHtml(noteTrimmed).replace(/\n/g, '<br/>')}</p>`
    : '';

  const htmlBody = `
<div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; background-color: #ffffff; max-width: 640px; padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 6px;">
  <h2 style="margin: 0 0 12px 0; padding-bottom: 10px; font-size: 16px; font-weight: 700; color: #111827; border-bottom: 2px solid #1a73e8;">
    Update Progress Request
  </h2>

  <p style="margin: 14px 0; font-size: 14px; line-height: 1.5; color: #1f2937;">
    Kepada Yth. <strong>${escapeHtml(greetingName)}</strong>,
  </p>

  <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.5; color: #1f2937;">
    Kami informasikan bahwa request Anda dengan detail berikut:
  </p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
    <tbody>
      <tr>
        <td style="width: 34%; padding: 10px 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 700; color: #111827; vertical-align: top;">
          Nomor Tiket
        </td>
        <td style="padding: 10px 12px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937; vertical-align: top;">
          ${escapeHtml(displayIdWithHash)}
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 700; color: #111827; vertical-align: top;">
          Subject Email
        </td>
        <td style="padding: 10px 12px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937; vertical-align: top;">
          ${escapeHtml(subjectEmail)}
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 700; color: #111827; vertical-align: top;">
          Tanggal Request
        </td>
        <td style="padding: 10px 12px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937; vertical-align: top;">
          ${escapeHtml(requestDateFormatted)}
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 700; color: #111827; vertical-align: top;">
          Status Terkini
        </td>
        <td style="padding: 10px 12px; background-color: #ffffff; border: 1px solid #e5e7eb; font-weight: 700; color: #111827; vertical-align: top;">
          ${escapeHtml(statusText)}
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 700; color: #111827; vertical-align: top;">
          Prioritas
        </td>
        <td style="padding: 10px 12px; background-color: #ffffff; border: 1px solid #e5e7eb; vertical-align: top;">
          <span style="display: inline-block; background-color: ${priorityBg}; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 4px; letter-spacing: 0.02em;">
            ${escapeHtml(priorityText)}
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 700; color: #111827; vertical-align: top;">
          PIC
        </td>
        <td style="padding: 10px 12px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937; vertical-align: top;">
          ${escapeHtml(picDisplay)}
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; font-weight: 700; color: #111827; vertical-align: top;">
          Target Selesai
        </td>
        <td style="padding: 10px 12px; background-color: #ffffff; border: 1px solid #e5e7eb; color: #1f2937; vertical-align: top;">
          ${escapeHtml(dueDateFormatted)}
        </td>
      </tr>
    </tbody>
  </table>

  <p style="margin: 14px 0 0 0; font-size: 14px; line-height: 1.5; color: #1f2937;">
    Saat ini request Anda berada pada tahap: <strong>${escapeHtml(statusText)}</strong>.
  </p>
  ${noteHtml}
  <p style="margin: 14px 0 12px 0; font-size: 14px; line-height: 1.5; color: #1f2937;">
    Untuk melihat detail lengkap dan riwayat, silakan klik link di bawah ini:
  </p>

  <div style="margin: 0 0 18px 0;">
    <a href="${DASHBOARD_LINK_URL}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1a73e8; color: #ffffff; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
      Lihat Dashboard
    </a>
  </div>

  <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.5; color: #1f2937;">
    Jika ada pertanyaan lebih lanjut, jangan ragu untuk membalas email ini atau menghubungi PIC.
  </p>

  <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.5; color: #1f2937;">
    Terima kasih atas perhatian dan kerjasamanya.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 18px 0 14px 0;" />

  <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1f2937;">
    Hormat kami,<br/>
    <strong>Tim IC Finance</strong>
  </p>
</div>
  `.trim();

  const plainBody = [
    'Update Progress Request',
    '',
    `Kepada Yth. ${greetingName},`,
    '',
    'Kami informasikan bahwa request Anda dengan detail berikut:',
    `Nomor Tiket     : ${displayIdWithHash}`,
    `Subject Email   : ${subjectEmail}`,
    `Tanggal Request : ${requestDateFormatted}`,
    `Status Terkini  : ${statusText}`,
    `Prioritas       : ${priorityText}`,
    `PIC             : ${picDisplay}`,
    `Target Selesai  : ${dueDateFormatted}`,
    '',
    `Saat ini request Anda berada pada tahap: ${statusText}.`,
    ...(noteTrimmed ? ['', noteTrimmed] : []),
    '',
    'Untuk melihat detail lengkap dan riwayat, silakan klik link di bawah ini:',
    `Lihat Dashboard: ${DASHBOARD_LINK_URL}`,
    '',
    'Jika ada pertanyaan lebih lanjut, jangan ragu untuk membalas email ini atau menghubungi PIC.',
    'Terima kasih atas perhatian dan kerjasamanya.',
    '',
    'Hormat kami,',
    'Tim IC Finance'
  ].join('\n');

  return { htmlBody, plainBody };
}

export function buildReplyAllDraft(
  task: Partial<Task>,
  assigneeOverride?: string
): {
  subject: string;
  to: string;
  cc: string;
  recipientName: string;
  picName: string;
  body: string;
  htmlBody: string;
} {
  const subject = formatReplySubject(task);
  const fromEmails = extractEmailAddresses(task.email_from || task.requestor);
  const originalToEmails = extractEmailAddresses(task.email_to);
  const originalCcEmails = extractEmailAddresses(task.email_cc);

  // "To" diisi oleh pengirim asli (From), sedangkan "To asli" dimasukkan ke CC bersama CC asli
  const primaryTo = Array.from(new Set(fromEmails.map(e => e.toLowerCase())));
  const toSet = new Set(primaryTo);
  const combinedCc = Array.from(
    new Set([...originalToEmails, ...originalCcEmails].map(e => e.toLowerCase()))
  ).filter(e => !toSet.has(e));

  const recipientName = extractRecipientDisplayName(task);
  const picName = (assigneeOverride !== undefined ? assigneeOverride : task.assignee || '').trim();
  const { htmlBody, plainBody } = buildProgressEmailContent({
    task,
    recipientName,
    picName
  });

  return {
    subject,
    to: primaryTo.join(', '),
    cc: combinedCc.join(', '),
    recipientName,
    picName,
    body: plainBody,
    htmlBody
  };
}
