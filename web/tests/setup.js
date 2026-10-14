import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import isolation from "../../test-support/network-isolation.cjs";
const restoreNetwork = isolation.installNetworkIsolation();
afterAll(restoreNetwork);
afterEach(cleanup);
