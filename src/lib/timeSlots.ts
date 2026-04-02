// src/lib/timeSlots.ts

export type TimeSlot = {
  label: string;   // "13:30 – 14:15"
  start: string;   // "13:30"
  end: string;     // "14:15"
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Generate all 45-minute slots for a full 24h period
export function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let totalMinutes = 0; // start at 00:00

  while (totalMinutes < 24 * 60) {
    const endMinutes = totalMinutes + 45;
    if (endMinutes > 24 * 60) break;

    const startH = Math.floor(totalMinutes / 60);
    const startM = totalMinutes % 60;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;

    const start = `${pad(startH)}:${pad(startM)}`;
    const end = `${pad(endH)}:${pad(endM)}`;

    slots.push({ label: `${start} – ${end}`, start, end });
    totalMinutes += 45;
  }

  return slots;
}

export const TIME_SLOTS = generateTimeSlots();
