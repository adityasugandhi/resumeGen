'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FileText, Clock, BarChart3, Search, Loader2, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import EventLogRow from './EventLogRow';
import MonitorTimingView from './MonitorTimingView';
import AgentResultCard from '@/components/agent/AgentResultCard';
import AgentPipelineStepper from '@/components/agent/AgentPipelineStepper';
import type { AgentRun } from '@/store/agentRunStore';
import type { AgentJobResult, PipelineStage } from '@/lib/ai/agent/types';

type Tab = 'log' | 'timing' | 'results';

interface RunDetailPanelProps {
  run: AgentRun | undefined;
}

const EVENTS_PER_PAGE = 200;

export default function RunDetailPanel({ run }: RunDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('log');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilters, setLevelFilters] = useState({ info: true, warn: true, error: true });
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [displayCount, setDisplayCount] = useState(EVENTS_PER_PAGE);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && activeTab === 'log') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [run?.events.length, autoScroll, activeTab]);

  // Pause auto-scroll on hover
  const handleMouseEnter = useCallback(() => setAutoScroll(false), []);
  const handleMouseLeave = useCallback(() => setAutoScroll(true), []);

  if (!run) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Select a run from the history panel</p>
        </div>
      </div>
    );
  }

  // Derive unique companies from events
  const companies = useMemo(() => {
    const set = new Set<string>();
    run.events.forEach((e) => {
      if (e.source && e.source !== 'agent' && e.source !== 'unknown') {
        set.add(e.source);
      }
    });
    return Array.from(set).sort();
  }, [run.events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return run.events.filter((e) => {
      if (!levelFilters[e.level]) return false;
      if (companyFilter !== 'all' && e.source !== companyFilter) return false;
      if (searchQuery) {
        const msg = JSON.stringify(e.event).toLowerCase();
        if (!msg.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [run.events, levelFilters, companyFilter, searchQuery]);

  const visibleEvents = filteredEvents.slice(-displayCount);
  const hasMore = filteredEvents.length > displayCount;

  // Pipeline stages as Map for the stepper
  const pipelineStagesMap = useMemo(() => {
    const map = new Map<PipelineStage, 'active' | 'completed' | 'skipped'>();
    Object.entries(run.pipelineStages).forEach(([key, value]) => {
      map.set(key as PipelineStage, value);
    });
    return map;
  }, [run.pipelineStages]);

  const workersMap = useMemo(() => {
    const map = new Map<string, { company: string; phase: string; jobsTotal: number; jobsProcessed: number }>();
    Object.entries(run.workers).forEach(([key, value]) => {
      map.set(key, value);
    });
    return map;
  }, [run.workers]);

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'log', label: 'Log', icon: FileText },
    { key: 'timing', label: 'Timing', icon: Clock },
    { key: 'results', label: 'Results', icon: BarChart3 },
  ];

  const toggleLevel = (level: 'info' | 'warn' | 'error') => {
    setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const handleAddToPipeline = (_result: AgentJobResult) => {
    // No-op in monitor view — read-only
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-w-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.key === 'log' && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px]">
                  {filteredEvents.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Log tab */}
      {activeTab === 'log' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Filter bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            {/* Level toggles */}
            <div className="flex items-center gap-1">
              {(['info', 'warn', 'error'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={cn(
                    'text-[10px] font-semibold uppercase px-2 py-1 rounded transition-colors',
                    levelFilters[level]
                      ? level === 'error'
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                        : level === 'warn'
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>

            {/* Company filter */}
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="text-[10px] px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="all">All sources</option>
              {companies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Text search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                className="w-full pl-6 pr-2 py-1 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {/* Auto-scroll indicator */}
            {run.status === 'running' && (
              <div className="flex items-center gap-1 ml-auto">
                <Loader2 className="w-3 h-3 text-violet-500 animate-spin" />
                <span className="text-[10px] text-gray-400">Live</span>
              </div>
            )}
          </div>

          {/* Event log */}
          <div
            ref={scrollRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="flex-1 overflow-y-auto"
          >
            {hasMore && (
              <button
                onClick={() => setDisplayCount((prev) => prev + EVENTS_PER_PAGE)}
                className="w-full py-2 text-[10px] text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronUp className="w-3 h-3" />
                Load {Math.min(filteredEvents.length - displayCount, EVENTS_PER_PAGE)} earlier events
              </button>
            )}
            {visibleEvents.map((tsEvent) => (
              <EventLogRow key={tsEvent.id} tsEvent={tsEvent} runStartedAt={run.startedAt} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Timing tab */}
      {activeTab === 'timing' && (
        <div className="flex-1 overflow-y-auto">
          <MonitorTimingView run={run} />
        </div>
      )}

      {/* Results tab */}
      {activeTab === 'results' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Pipeline stepper - read only summary */}
          <AgentPipelineStepper
            stages={pipelineStagesMap}
            currentPhase={run.currentPhase}
            workers={workersMap}
          />

          {/* Result cards */}
          {run.result ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{run.result.totalH1bSponsors}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">H1B Sponsors</p>
                </div>
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-center">
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{run.result.companiesSearched}</p>
                  <p className="text-xs text-teal-600 dark:text-teal-400">Companies Searched</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{run.result.results.length}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Jobs Matched</p>
                </div>
              </div>

              {run.result.results.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {run.result.results.map((r, i) => (
                    <AgentResultCard
                      key={`${r.company}-${r.title}-${i}`}
                      result={r}
                      index={i}
                      onAddToPipeline={handleAddToPipeline}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <p className="text-sm">No matched results for this run.</p>
                </div>
              )}
            </>
          ) : run.status === 'running' ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for results...</p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-sm">No results available for this run.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
