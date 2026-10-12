import type { PlaywrightTestConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const frontendRoot = path.resolve(__dirname, "../..");

export function testPaths(suite: string) {
  return {
    testDir: path.join(frontendRoot, "tests", suite),
    outputDir: path.join(frontendRoot, "test-results", suite),
  };
}

export function browserUse(baseURL: string): PlaywrightTestConfig["use"] {
  return {
    baseURL,
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    // Bài test đăng nhập chứa password/token nên không ghi trace.
    trace: "off",
  };
}

type ApplicationOptions = {
  suite: string;
  frontendPort: number;
  backendPort: number;
  backendArguments?: string[];
  allowedOrigins?: string[];
  bootstrapAdmin?: boolean;
  buildFrontendInCi?: boolean;
};

function adminBootstrapEnvironment() {
  process.env.LEARNOVA_TEST_ADMIN_EMAIL ??= `${randomUUID()}@example.com`;
  process.env.LEARNOVA_TEST_ADMIN_PASSWORD ??= randomUUID();

  return {
    ADMIN_BOOTSTRAP_ENABLED: "true",
    ADMIN_BOOTSTRAP_EMAIL: process.env.LEARNOVA_TEST_ADMIN_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD: process.env.LEARNOVA_TEST_ADMIN_PASSWORD,
    ADMIN_BOOTSTRAP_DISPLAY_NAME: "Quản trị kiểm thử",
  };
}

export function applicationConfig(options: ApplicationOptions): PlaywrightTestConfig {
  const frontend = `http://localhost:${options.frontendPort}`;
  const api = `http://localhost:${options.backendPort}`;
  const maven = process.platform === "win32" ? "..\\backend\\mvnw.cmd" : "../backend/mvnw";
  const backendArguments = [
    `--server.port=${options.backendPort}`,
    `--learnova.auth.allowed-origins=${(options.allowedOrigins ?? [frontend]).join(",")}`,
    ...(options.backendArguments ?? []),
  ].join(" ");
  const buildFrontend = options.buildFrontendInCi && Boolean(process.env.CI);

  return {
    ...testPaths(options.suite),
    fullyParallel: false,
    workers: 1,
    timeout: 90000,
    use: browserUse(frontend),
    webServer: [
      {
        command: `${maven} -f ../backend/pom.xml -B spring-boot:test-run "-Dspring-boot.run.arguments=${backendArguments}"`,
        cwd: frontendRoot,
        url: `${api}/api/v1/health`,
        timeout: 180000,
        // Mỗi lần chạy cần database và cấu hình fixture đúng của môi trường test.
        reuseExistingServer: false,
        env: options.bootstrapAdmin ? adminBootstrapEnvironment() : undefined,
      },
      {
        command: buildFrontend
          ? `npm run build && npm run start -- --port ${options.frontendPort}`
          : `npm run dev -- --port ${options.frontendPort}`,
        cwd: frontendRoot,
        url: frontend,
        env: { NEXT_PUBLIC_API_URL: api },
        timeout: buildFrontend ? 180000 : 120000,
        reuseExistingServer: false,
      },
    ],
  };
}
