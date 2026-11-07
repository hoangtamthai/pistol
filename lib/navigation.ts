export function workspaceReturnPath(value: string | null) {
  if (value === "/issues" || value === "/context") return value;
  return value && /^\/context\/issues(?:\/[A-Za-z0-9-]+)?$/.test(value) ? value : "/context/issues";
}
