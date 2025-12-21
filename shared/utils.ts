export const getLogger = (name: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (level: "debug" | "info" | "warn" | "error", ...args: any[]) => {
    console[level](`[${name}]`, ...args);
  };
};
