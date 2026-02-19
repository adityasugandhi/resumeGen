import { ApplicationQueue } from '../lib/cron/application-queue';

function printTable(items: { id: string; company: string; jobTitle: string; matchScore: number; gaps: string[]; status: string }[]) {
  if (items.length === 0) {
    console.log('  No items found.');
    return;
  }

  const header = `${'ID'.padEnd(10)} ${'Company'.padEnd(20)} ${'Role'.padEnd(30)} ${'Score'.padEnd(7)} ${'Status'.padEnd(10)} Gaps`;
  console.log(header);
  console.log('-'.repeat(header.length + 20));

  for (const item of items) {
    const gapStr = item.gaps.slice(0, 3).join(', ') || '-';
    console.log(
      `${item.id.padEnd(10)} ${item.company.slice(0, 19).padEnd(20)} ${item.jobTitle.slice(0, 29).padEnd(30)} ${String(item.matchScore).padEnd(7)} ${item.status.padEnd(10)} ${gapStr}`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const queue = new ApplicationQueue();

  switch (command) {
    case 'list': {
      const statusFilter = args[1] || 'pending';
      const validStatuses = ['pending', 'approved', 'rejected', 'submitted', 'failed', 'all'];
      if (!validStatuses.includes(statusFilter)) {
        console.error(`Invalid status: ${statusFilter}. Use: ${validStatuses.join(', ')}`);
        process.exit(1);
      }
      const items = statusFilter === 'all' ? await queue.listAll() : await queue.listByStatus(statusFilter as 'pending');
      console.log(`\n  Applications (${statusFilter}):\n`);
      printTable(items);
      console.log(`\n  Total: ${items.length}\n`);
      break;
    }

    case 'approve': {
      const id = args[1];
      if (id === '--all') {
        const count = await queue.approveAll();
        console.log(`Approved ${count} pending applications.`);
      } else if (id) {
        const success = await queue.approve(id);
        if (success) {
          console.log(`Approved: ${id}`);
        } else {
          console.error(`Failed to approve: ${id} (not found or not pending)`);
          process.exit(1);
        }
      } else {
        console.error('Usage: approve <id> | approve --all');
        process.exit(1);
      }
      break;
    }

    case 'reject': {
      const id = args[1];
      if (!id) {
        console.error('Usage: reject <id>');
        process.exit(1);
      }
      const success = await queue.reject(id);
      if (success) {
        console.log(`Rejected: ${id}`);
      } else {
        console.error(`Failed to reject: ${id} (not found or not pending)`);
        process.exit(1);
      }
      break;
    }

    case 'details': {
      const id = args[1];
      if (!id) {
        console.error('Usage: details <id>');
        process.exit(1);
      }
      const app = await queue.getById(id);
      if (!app) {
        console.error(`Application not found: ${id}`);
        process.exit(1);
      }
      console.log('\n  Application Details:\n');
      console.log(`  ID:        ${app.id}`);
      console.log(`  Company:   ${app.company}`);
      console.log(`  Title:     ${app.jobTitle}`);
      console.log(`  URL:       ${app.url}`);
      console.log(`  Location:  ${app.location}`);
      console.log(`  Score:     ${app.matchScore}%`);
      console.log(`  Status:    ${app.status}`);
      console.log(`  Queued:    ${app.queuedAt}`);
      if (app.reviewedAt) console.log(`  Reviewed:  ${app.reviewedAt}`);
      console.log(`  Resume:    ${app.tailoredResumePath || 'N/A'}`);
      console.log(`  PDF:       ${app.tailoredPdfPath || 'N/A'}`);
      console.log(`\n  Strengths: ${app.strengths.join(', ') || 'N/A'}`);
      console.log(`  Gaps:      ${app.gaps.join(', ') || 'N/A'}\n`);
      break;
    }

    default:
      console.log(`
  Usage:
    list [status]       List applications (default: pending)
    approve <id>        Approve a pending application
    approve --all       Approve all pending applications
    reject <id>         Reject a pending application
    details <id>        Show full details for an application

  Statuses: pending, approved, rejected, submitted, failed, all
      `);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
