import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only unmounts between tests by itself when vitest globals are on.
afterEach(cleanup);
