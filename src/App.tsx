import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRouter } from "./routes/AppRouter";
import { ThemeProvider } from "./theme/ThemeProvider";

const queryClient = new QueryClient();

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppRouter />
      </ThemeProvider>
    </QueryClientProvider>
  );
};
