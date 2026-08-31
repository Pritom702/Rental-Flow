// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: F18 maintenance cost / downtime helpers (pure functions, unit tested)
// ============================================================

// A job is "blocking" while it is still open or being worked on. A blocking job
// keeps the item out of the rental pool.
const BLOCKING = ['Open', 'In Progress'];

export function isBlocking(status) {
  return BLOCKING.includes(status);
}

// Total cost of one repair job = parts + labour.
export function jobCost({ parts_cost = 0, labour_cost = 0 } = {}) {
  return Number((Number(parts_cost || 0) + Number(labour_cost || 0)).toFixed(2));
}

// What an item's status should become given the jobs currently on it.
// While any job is blocking the item is 'Under Maintenance'. When the last one
// closes the item goes back to 'Available' — unless it is currently rented out,
// in which case the booking lifecycle owns the status and we leave it alone.
export function nextItemStatus(jobs = [], currentStatus = 'Available') {
  if (jobs.some((j) => isBlocking(j.status))) return 'Under Maintenance';
  if (currentStatus === 'Rented') return 'Rented';
  return 'Available';
}

// How many days a job kept the item off the shelf. Still-open jobs count up to
// `asOf` so the downtime figure keeps growing while the item is in the shop.
export function downtimeDays(job, asOf = new Date()) {
  if (!job?.reported_at) return 0;
  const start = new Date(job.reported_at).getTime();
  const end = job.completed_at ? new Date(job.completed_at).getTime() : new Date(asOf).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

// Roll a list of jobs up into the numbers the maintenance dashboard shows.
export function summarizeJobs(jobs = [], asOf = new Date()) {
  const open = jobs.filter((j) => isBlocking(j.status));
  const totalCost = jobs.reduce((sum, j) => sum + jobCost(j), 0);
  const totalDowntime = jobs.reduce((sum, j) => sum + downtimeDays(j, asOf), 0);
  return {
    jobCount: jobs.length,
    openCount: open.length,
    completedCount: jobs.filter((j) => j.status === 'Completed').length,
    totalCost: Number(totalCost.toFixed(2)),
    averageCost: jobs.length ? Number((totalCost / jobs.length).toFixed(2)) : 0,
    totalDowntimeDays: totalDowntime,
  };
}
