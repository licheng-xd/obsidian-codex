const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getWelcomeTitle(date = new Date()): string {
  return `Happy ${WEEKDAY_LABELS[date.getDay()]}`;
}
