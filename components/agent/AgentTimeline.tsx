'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { AgentStepEvent } from '@/lib/ai/agent/types';
import { eventConfig, getEventMessage } from '@/lib/agent-event-utils';

interface AgentTimelineProps {
  events: AgentStepEvent[];
}

export default function AgentTimeline({ events }: AgentTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [collapsedCompanies, setCollapsedCompanies] = React.useState<Set<string>>(new Set());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  // Filter out pipeline_stage events - they're rendered by the stepper component
  const filteredEvents = events.filter(event => event.type !== 'pipeline_stage');

  // Group events by company for worker events
  const groupedEvents = React.useMemo(() => {
    const result: Array<{ type: 'event'; event: AgentStepEvent; index: number } | { type: 'group'; company: string; events: Array<{ event: AgentStepEvent; index: number }> } | { type: 'divider'; event: AgentStepEvent; index: number }> = [];
    const companyGroups = new Map<string, Array<{ event: AgentStepEvent; index: number }>>();
    let inProcessingPhase = false;

    filteredEvents.forEach((event, index) => {
      // Handle phase transitions as dividers
      if (event.type === 'phase_transition') {
        if (event.phase === 'processing' && event.status === 'started') {
          inProcessingPhase = true;
        } else if (event.phase === 'processing' && event.status === 'completed') {
          inProcessingPhase = false;
        }
        result.push({ type: 'divider', event, index });
        return;
      }

      // Group worker events by company during processing phase
      if (inProcessingPhase && (event.type === 'worker_started' || event.type === 'worker_progress' || event.type === 'worker_completed' || event.type === 'worker_error')) {
        const company = event.company;
        if (!companyGroups.has(company)) {
          companyGroups.set(company, []);
        }
        companyGroups.get(company)!.push({ event, index });
      } else {
        // Add regular events
        result.push({ type: 'event', event, index });
      }
    });

    // Add company groups
    companyGroups.forEach((events, company) => {
      result.push({ type: 'group', company, events });
    });

    return result;
  }, [filteredEvents]);

  const toggleCompany = (company: string) => {
    setCollapsedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(company)) {
        next.delete(company);
      } else {
        next.add(company);
      }
      return next;
    });
  };

  return (
    <div ref={scrollRef} className="overflow-y-auto max-h-[400px] pr-2 -mr-2">
      <div className="relative">
        {/* Vertical line */}
        {filteredEvents.length > 1 && (
          <div className="absolute left-[19px] top-6 bottom-6 w-px bg-gray-200 dark:bg-gray-700" />
        )}

        <AnimatePresence initial={false}>
          {groupedEvents.map((item, _itemIndex) => {
            if (item.type === 'divider') {
              // Phase transition divider
              const event = item.event as AgentStepEvent & { type: 'phase_transition' };
              return (
                <motion.div
                  key={`divider-${item.index}`}
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                  className="relative my-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-300 dark:via-violet-700 to-transparent" />
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/50">
                      <Layers className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase">
                        Phase: {event.phase} — {event.status}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-300 dark:via-violet-700 to-transparent" />
                  </div>
                </motion.div>
              );
            }

            if (item.type === 'group') {
              // Company group
              const isCollapsed = collapsedCompanies.has(item.company);
              const latestEvent = item.events[item.events.length - 1];

              return (
                <motion.div
                  key={`group-${item.company}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCompany(item.company)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.company}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.events.length} events — {getEventMessage(latestEvent.event)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                      {item.events.map(({ event, index }) => {
                        const config = eventConfig[event.type] || eventConfig.error;
                        const Icon = config.icon;

                        return (
                          <div key={index} className="flex gap-2 pl-2">
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${config.bgColor}`}>
                              <Icon className={`w-3 h-3 ${config.color}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {getEventMessage(event)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            }

            // Regular event
            const { event, index } = item;
            const config = eventConfig[event.type] || eventConfig.error;
            const Icon = config.icon;
            const isLatest = index === filteredEvents.length - 1;
            const isCodeAgentStep = event.type === 'code_agent_step';

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className={`flex gap-3 mb-3 last:mb-0 ${isCodeAgentStep ? 'ml-8 border-l-2 border-orange-400 pl-3' : ''}`}
              >
                {/* Icon */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`
                      ${isCodeAgentStep ? 'w-7 h-7' : 'w-10 h-10'} rounded-xl flex items-center justify-center
                      ${config.bgColor} ${config.color}
                      ${isLatest ? 'ring-2 ring-current ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''}
                    `}
                  >
                    <Icon className={isCodeAgentStep ? 'w-3 h-3' : 'w-4 h-4'} />
                  </div>
                  {isLatest && (
                    <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ${config.color.replace('text-', 'bg-')} animate-pulse`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
                      {config.label}
                    </span>
                    {event.type === 'code_agent_step' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
                        Step {event.iteration}/{event.maxIterations}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed truncate">
                    {getEventMessage(event)}
                  </p>

                  {/* Extra metadata for specific events */}
                  {event.type === 'matched' && event.gaps.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.gaps.slice(0, 3).map((gap, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                          {gap}
                        </span>
                      ))}
                    </div>
                  )}

                  {event.type === 'companies_discovered' && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.companies.slice(0, 5).map((c, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {event.type === 'browser_action' && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {event.element}
                    </div>
                  )}

                  {event.type === 'captcha_detected' && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 font-semibold">
                        Manual intervention required
                      </span>
                    </div>
                  )}

                  {event.type === 'form_scraped' && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.fields.slice(0, 6).map((field, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                          {field}
                        </span>
                      ))}
                    </div>
                  )}

                  {event.type === 'application_submitted' && !event.success && (
                    <div className="mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                        {event.error}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}