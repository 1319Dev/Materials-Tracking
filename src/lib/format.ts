export function formatWhen(value: string, withYear = false) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}
