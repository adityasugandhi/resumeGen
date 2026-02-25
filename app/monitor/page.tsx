'use client';

import { useAgentRunStore } from '@/store/agentRunStore';
import Sidebar from '@/components/Sidebar/Sidebar';
import RunHistoryPanel from '@/components/monitor/RunHistoryPanel';
import RunDetailPanel from '@/components/monitor/RunDetailPanel';
import LiveStatsPanel from '@/components/monitor/LiveStatsPanel';

export default function MonitorPage() {
  const displayRun = useAgentRunStore((s) => s.getDisplayRun());

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex min-w-0">
        <RunHistoryPanel />
        <RunDetailPanel run={displayRun} />
        <LiveStatsPanel run={displayRun} />
      </div>
    </div>
  );
}
