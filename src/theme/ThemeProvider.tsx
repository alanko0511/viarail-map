import { createTheme, MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import type { PropsWithChildren } from "react";

const theme = createTheme({});

export const ThemeProvider = (props: PropsWithChildren) => {
  return <MantineProvider theme={theme}>{props.children}</MantineProvider>;
};
