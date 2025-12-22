import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure } from "onedollarstats";
import { useEffect } from "react";
import { AppRouter } from "./routes/AppRouter";
import { ThemeProvider } from "./theme/ThemeProvider";

const queryClient = new QueryClient();

export const App = () => {
  useEffect(() => {
    configure({
      trackLocalhostAs: "viarail-map.alanko.dev",
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppRouter />
      </ThemeProvider>
    </QueryClientProvider>
  );
};
