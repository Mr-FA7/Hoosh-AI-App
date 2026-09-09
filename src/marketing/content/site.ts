/**
 * Verified marketing content — only claim what the codebase supports.
 * Labels: confirmed | conditional | caveat | legacy
 */
import {
  COMPANY,
  DOWNLOAD_MAC,
  DOWNLOAD_WIN,
  GITHUB_CHANGELOG,
  GITHUB_DISCUSSIONS,
  GITHUB_ISSUES,
  GITHUB_LICENSE,
  GITHUB_PRIVACY,
  GITHUB_SECURITY,
  HOOSH_VERSION,
  RELEASES_REPO,
  SOURCE_REPO,
} from '../release';

export type FeatureStatus = 'confirmed' | 'conditional' | 'caveat' | 'legacy';

export type FeatureItem = {
  id: string;
  title: string;
  body: string;
  status: FeatureStatus;
  statusNote?: string;
};

export const SITE_LINKS = {
  source: SOURCE_REPO,
  releases: RELEASES_REPO,
  issues: GITHUB_ISSUES,
  discussions: GITHUB_DISCUSSIONS,
  security: GITHUB_SECURITY,
  license: GITHUB_LICENSE,
  privacy: GITHUB_PRIVACY,
  changelog: GITHUB_CHANGELOG,
  downloadMac: DOWNLOAD_MAC,
  downloadWin: DOWNLOAD_WIN,
} as const;

export const PRODUCT_NAME = 'Hoosh AI';

export const POSITIONING = {
  eyebrow: 'Local-first AI agent platform',
  headline: 'Your models. Your machine. Your workflow.',
  support:
    'Hoosh is a local-first AI agent platform designed to run on your machine and connect to the models and AI services you choose — from local LLMs to compatible APIs.',
  notChatbot:
    'Hoosh is an agent workspace: Control Plane UI, Local Runtime, and tools around your projects — not merely a hosted chatbot.',
  companyLine: `${PRODUCT_NAME} is a product of ${COMPANY}.`,
};

export { COMPANY, HOOSH_VERSION };

export const FEATURES: FeatureItem[] = [
  {
    id: 'desktop',
    title: 'Hoosh Desktop',
    body: 'A PyQt6 WebEngine desktop shell that launches the Local Runtime and loads the Control Plane in a dedicated window.',
    status: 'confirmed',
  },
  {
    id: 'runtime',
    title: 'Local Runtime',
    body: 'A Node-based Runtime on your machine (default 127.0.0.1:3001) that serves the UI and exposes project, tool, and model APIs.',
    status: 'confirmed',
  },
  {
    id: 'control-plane',
    title: 'Control Plane UI',
    body: 'A React workspace for agents, files, terminal, settings, and model configuration — running through the local Desktop/Runtime path.',
    status: 'confirmed',
  },
  {
    id: 'agents',
    title: 'Agent workflows',
    body: 'Agent loops with structured tools for reading and writing files, searching the workspace, and running approved commands.',
    status: 'confirmed',
  },
  {
    id: 'files',
    title: 'Files & workspace',
    body: 'Browse and edit project files through the Local Runtime with workspace-scoped filesystem tools.',
    status: 'confirmed',
  },
  {
    id: 'terminal',
    title: 'Terminal',
    body: 'Integrated terminal / PTY support for working alongside agents in the same local environment.',
    status: 'confirmed',
  },
  {
    id: 'git',
    title: 'Git',
    body: 'Git status, diff, stage, commit, and remote operations from the Control Plane when Git is available on your machine.',
    status: 'confirmed',
  },
  {
    id: 'docker',
    title: 'Docker & stacks',
    body: 'Container and stack tooling when Docker or Podman is installed locally. Hoosh does not bundle a container engine.',
    status: 'conditional',
    statusNote: 'Requires Docker or Podman on your machine',
  },
  {
    id: 'models',
    title: 'Bring your own models',
    body: 'Connect Ollama, LM Studio, OpenAI-compatible endpoints, and optional cloud providers you configure. Hoosh does not sell inference tokens.',
    status: 'confirmed',
  },
  {
    id: 'auth',
    title: 'Account sign-in',
    body: 'The local Control Plane uses Firebase Authentication for account surfaces. Network access is required to sign in.',
    status: 'caveat',
    statusNote: 'Account gate uses Firebase Auth',
  },
];

export const AUDIENCES = [
  {
    title: 'Developers',
    body: 'Build and experiment with AI agents alongside your existing development workflow — files, terminal, and Git on your machine.',
  },
  {
    title: 'Local AI users',
    body: 'Connect locally hosted models such as Ollama or LM Studio and keep more of the agent workflow on your own machine.',
  },
  {
    title: 'AI builders',
    body: 'Experiment with agents, tools, and model connections without being locked into a single hosted model product.',
  },
];

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Is Hoosh free?',
    a: 'Yes. Hoosh is free to download and use under the project license. If you connect paid third-party model APIs, those providers bill you under their own terms. Hoosh does not require a Hoosh AI token balance.',
  },
  {
    q: 'Does Hoosh run locally?',
    a: 'Hoosh is designed around a Local Runtime and Desktop app on your machine. The public website is for discovery and download — not the place where the IDE lives.',
  },
  {
    q: 'Does Hoosh require an AI subscription?',
    a: 'No Hoosh subscription is required for the core product. You choose model infrastructure: local engines and/or APIs you configure.',
  },
  {
    q: 'Can I use Ollama?',
    a: 'Yes. Ollama is a first-class local provider path in the Runtime model gateway.',
  },
  {
    q: 'Can I use LM Studio?',
    a: 'Yes. LM Studio is supported via its OpenAI-compatible local endpoint.',
  },
  {
    q: 'Can I use OpenAI-compatible APIs?',
    a: 'Yes. You can configure OpenAI-compatible endpoints (and optional providers such as Anthropic or OpenRouter) with your own keys.',
  },
  {
    q: 'Does Hoosh work offline?',
    a: 'Local model workflows can run on your machine once Desktop and Runtime are set up. Sign-in uses Firebase Auth (network). First Runtime setup may need Node and network. Cloud model APIs and web tools require network by design.',
  },
  {
    q: 'Is Hoosh open source?',
    a: 'Hoosh is source-available rather than conventional Open Source. The source is public for transparency, inspection, and permitted use under the project LICENSE — not an OSI-style unrestricted license.',
  },
  {
    q: 'Where is the source code?',
    a: `Source: ${SOURCE_REPO}. Installers: ${RELEASES_REPO}.`,
  },
  {
    q: 'What operating systems are supported?',
    a: 'Primary download paths are macOS and Windows desktop installers. Linux packaging scripts exist in the repo but are not the primary public CTA.',
  },
  {
    q: 'Why is macOS showing “Not Opened”?',
    a: 'Current macOS builds are not Apple notarized. Gatekeeper may block first launch. Use the Terminal install steps in Download / Docs (START HERE.txt in the DMG).',
  },
  {
    q: 'Who makes Hoosh?',
    a: `Hoosh AI is a product of ${COMPANY}.`,
  },
];

export const CHANGELOG_ENTRIES = [
  {
    version: '1.0.0',
    date: '2026-09-09',
    highlights: [
      'Initial public source-available release (docs, LICENSE, community files, CI).',
      'Local-first Control Plane UI with Firebase Auth for account surfaces.',
      'Hoosh Local Runtime for filesystem, terminal, tooling, and model providers.',
      'Hoosh Desktop (PyQt6) shell with Runtime desktop gate.',
      'Hosted website oriented to marketing and download (not IDE-in-browser).',
      'Known limitation: macOS builds are not Apple notarized.',
    ],
  },
];

export const NAV_PRIMARY = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/models', label: 'Models' },
  { to: '/docs', label: 'Docs' },
  { to: '/download', label: 'Download' },
] as const;

export const FOOTER_PRODUCT = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/download', label: 'Download' },
  { to: '/models', label: 'Models' },
  { to: '/security', label: 'Security' },
  { to: '/changelog', label: 'Changelog' },
] as const;

export const FOOTER_RESOURCES = [
  { to: '/docs', label: 'Documentation' },
  { href: SOURCE_REPO, label: 'GitHub' },
  { href: RELEASES_REPO, label: 'Releases' },
  { to: '/license', label: 'License' },
] as const;

export const FOOTER_COMPANY = [
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/privacy', label: 'Privacy' },
] as const;
