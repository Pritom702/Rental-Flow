export function calculateDeposit(replacementCost, rate = 0.2) {
  return Number((Number(replacementCost || 0) * rate).toFixed(2));
}

export function calculateLateFee(rentalPrice, overdueDays, rate = 0.1) {
  return Number((Number(rentalPrice || 0) * rate * Math.max(0, Number(overdueDays || 0))).toFixed(2));
}

export function hasDateOverlap(startDate, endDate, existingStart, existingEnd) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const existingStartDate = new Date(`${existingStart}T00:00:00`);
  const existingEndDate = new Date(`${existingEnd}T00:00:00`);
  return start < existingEndDate && end > existingStartDate;
}
