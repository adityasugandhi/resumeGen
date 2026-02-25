import {
  Globe,
  Building2,
  Search,
  Briefcase,
  FileText,
  Target,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Code2,
  Brain,
  Database,
  Users,
  Save,
  FileCheck,
  Plug,
  Layers,
  Terminal,
  ShieldAlert,
  MousePointerClick,
  ScanSearch,
  ShieldQuestion,
} from 'lucide-react';
import type { AgentStepEvent } from '@/lib/ai/agent/types';
import type { EventLevel } from '@/store/agentRunStore';

export const eventConfig: Record<
  AgentStepEvent['type'],
  { icon: typeof Globe; color: string; bgColor: string; label: string }
> = {
  h1b_scan: { icon: Globe, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'H1B Scan' },
  registry_match: { icon: Building2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Registry Match' },
  searching: { icon: Search, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', label: 'Searching' },
  jobs_found: { icon: Briefcase, color: 'text-teal-500', bgColor: 'bg-teal-500/10', label: 'Jobs Found' },
  fetching: { icon: FileText, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', label: 'Fetching' },
  matched: { icon: Target, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Matched' },
  optimizing: { icon: Sparkles, color: 'text-amber-500', bgColor: 'bg-amber-500/10', label: 'Optimizing' },
  optimized: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Optimized' },
  error: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Error' },
  self_healing: { icon: Wrench, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Self-Healing' },
  code_fix: { icon: Code2, color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Code Fix' },
  memory_recall: { icon: Brain, color: 'text-pink-500', bgColor: 'bg-pink-500/10', label: 'Memory Recall' },
  memory_store: { icon: Database, color: 'text-violet-500', bgColor: 'bg-violet-500/10', label: 'Memory Store' },
  resume_loaded: { icon: FileText, color: 'text-sky-500', bgColor: 'bg-sky-500/10', label: 'Resume Loaded' },
  engineering_roles: { icon: Users, color: 'text-teal-500', bgColor: 'bg-teal-500/10', label: 'Eng Roles' },
  companies_discovered: { icon: Building2, color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Discovered' },
  company_registered: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Registered' },
  file_saved: { icon: Save, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'File Saved' },
  pdf_compiled: { icon: FileCheck, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'PDF Compiled' },
  new_provider: { icon: Plug, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', label: 'New Provider' },
  memory_health: { icon: Wrench, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Memory Health' },
  pipeline_stage: { icon: Layers, color: 'text-violet-500', bgColor: 'bg-violet-500/10', label: 'Pipeline' },
  code_agent_step: { icon: Terminal, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Code Agent' },
  intervention_required: { icon: ShieldAlert, color: 'text-amber-500', bgColor: 'bg-amber-500/10', label: 'Intervention' },
  intervention_resolved: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Resolved' },
  worker_started: { icon: Users, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', label: 'Worker Started' },
  worker_progress: { icon: Layers, color: 'text-violet-500', bgColor: 'bg-violet-500/10', label: 'Worker Progress' },
  worker_completed: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Worker Done' },
  worker_error: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Worker Error' },
  parallel_batch: { icon: Layers, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', label: 'Batch' },
  phase_transition: { icon: Layers, color: 'text-violet-500', bgColor: 'bg-violet-500/10', label: 'Phase' },
  applying: { icon: MousePointerClick, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Applying' },
  application_submitted: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Applied' },
  browser_action: { icon: MousePointerClick, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', label: 'Browser' },
  captcha_detected: { icon: ShieldQuestion, color: 'text-amber-500', bgColor: 'bg-amber-500/10', label: 'CAPTCHA' },
  form_scraped: { icon: ScanSearch, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', label: 'Form Scan' },
};

export function getEventMessage(event: AgentStepEvent): string {
  switch (event.type) {
    case 'h1b_scan':
      return event.message;
    case 'registry_match':
      return `Matched: ${event.matchedCompanies.join(', ')}`;
    case 'searching':
      return `Searching ${event.company}: "${event.query}"`;
    case 'jobs_found':
      return `Found ${event.count} jobs at ${event.company}`;
    case 'fetching':
      return `Fetching: ${event.jobTitle}`;
    case 'matched':
      return `${event.jobTitle} at ${event.company} — ${event.score}% match`;
    case 'optimizing':
      return `Optimizing resume for ${event.jobTitle} at ${event.company}`;
    case 'optimized':
      return `Optimized for ${event.jobTitle} — ${event.changeCount} changes`;
    case 'error':
      return event.message;
    case 'self_healing':
      return `Fixing ${event.tool}: ${event.message}`;
    case 'code_fix':
      return event.summary;
    case 'memory_recall':
      return event.message;
    case 'memory_store':
      return `Stored ${event.category}: ${event.message}`;
    case 'resume_loaded':
      return `${event.message} (${event.experiences} exp, ${event.skills} skills, ${event.projects} projects)`;
    case 'engineering_roles':
      return `${event.company}: ${event.engineeringCount}/${event.totalJobs} engineering roles`;
    case 'companies_discovered':
      return `${event.message} (${event.companies.length} companies)`;
    case 'company_registered':
      return `${event.company} registered (${event.platform})`;
    case 'file_saved':
      return `Saved to ${event.company}`;
    case 'pdf_compiled':
      return `PDF compiled via ${event.compilationMethod}`;
    case 'new_provider':
      return `New provider: ${event.company} (${event.platform})`;
    case 'memory_health':
      return event.message;
    case 'pipeline_stage':
      return `Stage: ${event.stage} — ${event.status}`;
    case 'code_agent_step':
      return `[${event.iteration}/${event.maxIterations}] ${event.detail}`;
    case 'intervention_required':
      return `Tool "${event.tool}" failed — waiting for user action`;
    case 'intervention_resolved':
      return `User chose: ${event.action}`;
    case 'worker_started':
      return `Worker started for ${event.company} (ID: ${event.workerId})`;
    case 'worker_progress':
      return `${event.company}: ${event.phase} — ${event.jobsProcessed}/${event.jobsTotal} jobs`;
    case 'worker_completed':
      return `${event.company} completed — ${event.jobsMatched} matched, top score: ${event.topScore}%`;
    case 'worker_error':
      return `${event.company}: ${event.error}`;
    case 'parallel_batch':
      return `Batch ${event.batchIndex} ${event.status} — ${event.companies.join(', ')}`;
    case 'phase_transition':
      return `Phase ${event.phase} ${event.status}`;
    case 'applying':
      return `Applying to ${event.jobTitle} at ${event.company} via ${event.method}`;
    case 'application_submitted':
      return event.success
        ? `Application submitted via ${event.method}${event.confirmationId ? ` (${event.confirmationId})` : ''}`
        : `Application failed: ${event.error || 'unknown error'}`;
    case 'browser_action':
      return `${event.action}: ${event.element}`;
    case 'captcha_detected':
      return `CAPTCHA detected at ${event.company}${event.requiresHuman ? ' — requires manual solving' : ''}`;
    case 'form_scraped':
      return `Found ${event.fieldCount} form fields: ${event.fields.slice(0, 5).join(', ')}`;
    default:
      return 'Processing...';
  }
}

export function getEventLevel(type: AgentStepEvent['type']): EventLevel {
  switch (type) {
    case 'error':
    case 'worker_error':
      return 'error';
    case 'self_healing':
    case 'intervention_required':
    case 'code_fix':
    case 'memory_health':
    case 'captcha_detected':
      return 'warn';
    default:
      return 'info';
  }
}

export function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const mil = date.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${mil}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
