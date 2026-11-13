import { Task } from '../types';

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

export function formatReplySubject(task: Partial<Task>): string {
  const baseSubject = (task.email_subject || task.title || 'Task Update').trim();
  if (/^re:/i.test(baseSubject)) {
    return baseSubject;
  }
  return `Re: ${baseSubject}`;
}

export function buildReplyAllDraft(
  task: Partial<Task>,
  assigneeOverride?: string
): {
  subject: string;
  to: string;
  cc: string;
  body: string;
} {
  const subject = formatReplySubject(task);
  const fromEmails = extractEmailAddresses(task.email_from || task.requestor);
  const toEmails = extractEmailAddresses(task.email_to);
  const ccEmails = extractEmailAddresses(task.email_cc);

  const combinedTo = Array.from(new Set([...fromEmails, ...toEmails].map(e => e.toLowerCase())));
  const toSet = new Set(combinedTo);
  const filteredCc = Array.from(new Set(ccEmails.map(e => e.toLowerCase()))).filter(e => !toSet.has(e));

  const displayId = task.display_id || (task.id ? `IC-${task.id}` : 'Task');
  const title = task.title || task.email_subject || '-';
  const assignee = (assigneeOverride !== undefined ? assigneeOverride : task.assignee || '').trim();
  const statusLabel = task.status || 'TODO';

  const body = assignee
    ? `Halo,\n\nSebagai informasi, task dari email ini saat ini sedang diproses oleh ${assignee}.\n\nID Task : ${displayId}\nJudul   : ${title}\nAssignee: ${assignee}\nStatus  : ${statusLabel}\n\nTerima kasih,\nIC Team`
    : `Halo,\n\nBerikut informasi pembaruan untuk task dari email ini:\n\nID Task : ${displayId}\nJudul   : ${title}\nStatus  : ${statusLabel}\n\nTerima kasih,\nIC Team`;

  return {
    subject,
    to: combinedTo.join(', '),
    cc: filteredCc.join(', '),
    body
  };
}
