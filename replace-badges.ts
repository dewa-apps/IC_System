import fs from 'fs';

let appContent = fs.readFileSync('src/App.tsx', 'utf8');

const appReplacements = [
  // Task card category
  { from: /text-\[10px\] px-1\.5 py-0\.5 text-\[var\(--accent-color\)\] bg-\[var\(--accent-color\)\] bg-opacity-10 rounded font-medium/g, to: 'text-[10px] px-1.5 py-0.5 badge-accent rounded font-medium' },
  { from: /text-\[10px\] text-\[var\(--accent-color\)\] font-medium/g, to: 'text-[10px] text-[var(--badge-accent-text)] font-medium' },
  // Task card brand
  { from: /text-\[10px\] px-1\.5 py-0\.5 bg-\[var\(--accent-color\)\] bg-opacity-10 text-\[var\(--accent-color\)\] rounded font-medium/g, to: 'text-[10px] px-1.5 py-0.5 badge-purple rounded font-medium' },
  // Table tasks list first column
  { from: /<td className="px-4 py-3 text-xs font-bold text-\[var\(--text-muted\)\]">\{task\.display_id \|\| `IC-\$\{task\.id\}`\}<\/td>/g, to: '<td className="px-4 py-3 text-xs font-bold text-[var(--accent-color)] hover:underline">{task.display_id || `IC-${task.id}`}</td>' },
  // Page number table tasks list
  { from: /className=\{`w-6 h-6 text-\[10px\] font-bold rounded transition-all \$\{currentPage === page \? 'btn-primary' : 'text-\[var\(--text-secondary\)\] hover:bg-\[var\(--bg-primary\)\]'\}`\}/g, to: 'className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded transition-all ${currentPage === page ? \'bg-[var(--accent-color)] text-[var(--text-on-accent)]\' : \'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary-hover)]\'}`}' },
  // Linked Task info status
  { from: /bg-\[var\(--success-color\)\] bg-opacity-10 text-\[var\(--success-color\)\]/g, to: 'badge-success' },
  { from: /bg-\[var\(--accent-color\)\] bg-opacity-10 text-\[var\(--accent-color\)\]/g, to: 'badge-accent' },
  { from: /bg-\[var\(--warning-color\)\] bg-opacity-10 text-\[var\(--warning-color\)\]/g, to: 'badge-warning' },
  { from: /bg-\[var\(--bg-secondary-hover\)\] text-\[var\(--text-secondary\)\]/g, to: 'badge-neutral' }
];

appReplacements.forEach(({ from, to }) => {
  appContent = appContent.replace(from, to);
});

fs.writeFileSync('src/App.tsx', appContent, 'utf8');

let settingsContent = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

const settingsReplacements = [
  // Settings > Profil (info role)
  { from: /bg-blue-100 text-blue-800 dark:bg-blue-900\/30 dark:text-blue-300/g, to: 'badge-accent' },
  // Settings > User Management (info Role)
  { from: /bg-purple-100 text-purple-800 dark:bg-purple-900\/30 dark:text-purple-300/g, to: 'badge-purple' },
  { from: /bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300/g, to: 'badge-neutral' }
];

settingsReplacements.forEach(({ from, to }) => {
  settingsContent = settingsContent.replace(from, to);
});

fs.writeFileSync('src/components/SettingsView.tsx', settingsContent, 'utf8');

console.log('Replacements complete.');
