import { APP_INITIALIZER } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ROUTES, Route, Router, UrlTree, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, toArray } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { DeviceType } from "@bitwarden/common/enums";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
// eslint-disable-next-line no-restricted-imports -- the class under extension
import { SignalRConnectionService } from "@bitwarden/common/platform/server-notifications/internal";
import { ApiService } from "@bitwarden/common/services/api.service";
import { UserId } from "@bitwarden/common/types/guid";

import {
  ExportOnlySignalRConnectionService,
  exportOnlyFetchGate,
  exportOnlyRedirectGuard,
  exportOnlySessionGuard,
  isExportOnlyToken,
} from "./export-only";
import { RestrictedExportComponent } from "./restricted-export.component";

const userId = "c7312a46-17c4-4a8c-965b-123456789abc" as UserId;
const jwt = (claims: object) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const exportToken = jwt({ sub: userId, export_only: true });
const ordinaryToken = jwt({ sub: userId });

describe("isExportOnlyToken", () => {
  it("is true only for an export_only: true claim", () => {
    expect(isExportOnlyToken(exportToken)).toBe(true);
    expect(isExportOnlyToken(ordinaryToken)).toBe(false);
    expect(isExportOnlyToken(jwt({ export_only: "true" }))).toBe(false);
    expect(isExportOnlyToken("not-a-jwt")).toBe(false);
    expect(isExportOnlyToken(null)).toBe(false);
  });
});

/** The real ApiService, with the network replaced by a server that 403s every route but export. */
function apiWithServer(token: string, gate: boolean) {
  const tokens = mock<TokenService>();
  tokens.getAccessToken.mockResolvedValue(token);
  tokens.tokenNeedsRefresh.mockResolvedValue(false);
  const environment = mock<EnvironmentService>();
  const env = { getApiUrl: () => "https://vault.test/api" } as Environment;
  environment.environment$ = of(env);
  environment.getEnvironment$.mockReturnValue(of(env));
  const platform = mock<PlatformUtilsService>();
  platform.getDevice.mockReturnValue(DeviceType.ChromeBrowser);
  const accounts = mock<AccountService>();
  accounts.activeAccount$ = of({ id: userId } as never);
  const logout = jest.fn().mockResolvedValue(undefined);
  const api = new ApiService(
    tokens,
    platform,
    environment,
    mock(),
    jest.fn(),
    mock(),
    logout,
    mock(),
    accounts,
    {
      createRequest: (url, init) =>
        ({ url, method: init.method, headers: new Headers(init.headers) }) as Request,
    },
  );
  const network: string[] = [];
  jest.spyOn(api, "nativeFetch").mockImplementation(async (request) => {
    const path = `${request.method} ${new URL(request.url).pathname}`;
    network.push(path);
    const ok = path === "GET /api/tenancy/export";
    return {
      ok,
      status: ok ? 200 : 403,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () => Promise.resolve(ok ? { object: "kyvaultRestrictedExport" } : {}),
    } as Response;
  });
  if (gate) {
    api.addMiddleware(exportOnlyFetchGate());
  }
  return { api, network, logout };
}

describe("exportOnlyFetchGate", () => {
  it("never sends sync or any other vault call for an export-only session, and never logs out", async () => {
    const { api, network, logout } = apiWithServer(exportToken, true);

    await expect(api.getSync()).rejects.toMatchObject({ statusCode: 423 });
    await expect(
      api.send("GET", "/accounts/revision-date", null, userId, true),
    ).rejects.toBeDefined();
    await expect(api.send("GET", "/config", null, userId, true)).rejects.toBeDefined();
    await expect(api.send("POST", "/tenancy/export", null, userId, true)).rejects.toBeDefined();
    await expect(api.send("GET", "/tenancy/export", null, userId, true)).resolves.toEqual({
      object: "kyvaultRestrictedExport",
    });

    expect(network).toEqual(["GET /api/tenancy/export"]);
    expect(logout).not.toHaveBeenCalled();
  });

  it("without the gate, the first sync reaches the server and its 403 logs the user out", async () => {
    const { api, network, logout } = apiWithServer(exportToken, false);

    await expect(api.getSync()).rejects.toBeDefined();

    expect(network).toEqual(["GET /api/sync"]);
    expect(logout).toHaveBeenCalledWith("invalidAccessToken");
  });

  it("leaves ordinary sessions untouched", async () => {
    const { api, network } = apiWithServer(ordinaryToken, true);

    await expect(api.getSync()).rejects.toBeDefined();
    expect(network).toEqual(["GET /api/sync"]);
  });
});

describe("ExportOnlySignalRConnectionService", () => {
  function service(token: string) {
    const tokens = mock<TokenService>();
    tokens.getAccessToken.mockResolvedValue(token);
    const connect = jest
      .spyOn(SignalRConnectionService.prototype, "connect$")
      .mockReturnValue(of({ type: "Connected" }));
    return { sut: new ExportOnlySignalRConnectionService(tokens, mock(), mock(), mock()), connect };
  }

  afterEach(() => jest.restoreAllMocks());

  it("never opens the hub for an export-only session", async () => {
    const { sut, connect } = service(exportToken);
    await expect(
      firstValueFrom(sut.connect$(userId, "https://vault.test/notifications").pipe(toArray())),
    ).resolves.toEqual([]);
    expect(connect).not.toHaveBeenCalled();
  });

  it("connects ordinary sessions", async () => {
    const { sut, connect } = service(ordinaryToken);
    await expect(
      firstValueFrom(sut.connect$(userId, "https://vault.test/notifications").pipe(toArray())),
    ).resolves.toEqual([{ type: "Connected" }]);
    expect(connect).toHaveBeenCalledWith(userId, "https://vault.test/notifications");
  });
});

describe("export-only guards", () => {
  const account$ = new BehaviorSubject<{ id: UserId } | null>({ id: userId });
  const tokens = mock<TokenService>();

  beforeEach(() => {
    account$.next({ id: userId });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AccountService, useValue: { activeAccount$: account$ } },
        { provide: TokenService, useValue: tokens },
      ],
    });
  });

  const run = (guard: typeof exportOnlyRedirectGuard) =>
    TestBed.runInInjectionContext(() => guard({} as never, {} as never)) as Promise<
      boolean | UrlTree
    >;
  const url = (result: boolean | UrlTree) =>
    typeof result === "boolean" ? result : TestBed.inject(Router).serializeUrl(result);

  it("sends an export-only session from the lock screen to the export screen", async () => {
    tokens.getAccessToken.mockResolvedValue(exportToken);
    expect(url(await run(exportOnlyRedirectGuard))).toBe("/restricted-export");
    expect(await run(exportOnlySessionGuard)).toBe(true);
  });

  it("keeps ordinary sessions on the lock screen and off the export screen", async () => {
    tokens.getAccessToken.mockResolvedValue(ordinaryToken);
    expect(await run(exportOnlyRedirectGuard)).toBe(true);
    expect(url(await run(exportOnlySessionGuard))).toBe("/");
    account$.next(null);
    expect(url(await run(exportOnlySessionGuard))).toBe("/");
  });
});

describe("web CoreModule wiring", () => {
  // The real module's providers, so dropping the registration fails here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CoreModule } = require("../core/core.module");
  const providers = (CoreModule.ɵinj.providers as unknown[]).flat(Infinity) as {
    provide?: unknown;
    useClass?: unknown;
    useFactory?: (...deps: unknown[]) => unknown;
  }[];

  it("replaces the notifications hub connection", () => {
    expect(providers.find((p) => p.provide === SignalRConnectionService)?.useClass).toBe(
      ExportOnlySignalRConnectionService,
    );
  });

  it("installs the fetch gate at startup", () => {
    const api = mock<ApiService>();
    for (const p of providers.filter((p) => p.provide === APP_INITIALIZER)) {
      const init = p.useFactory?.(api);
      if (typeof init === "function") {
        init();
      }
    }
    expect(api.addMiddleware).toHaveBeenCalledTimes(1);
  });
});

describe("web routes", () => {
  const find = (path: string, list: Route[]): Route | undefined =>
    list.map((r) => (r.path === path ? r : find(path, r.children ?? []))).find(Boolean);

  it("sends the lock screen's export-only sessions to the export screen first", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OssRoutingModule } = require("../oss-routing.module");
    TestBed.configureTestingModule({ imports: [OssRoutingModule] });
    const routes = TestBed.inject(ROUTES).flat(Infinity) as Route[];

    expect(find("lock", routes)?.canActivate?.[0]).toBe(exportOnlyRedirectGuard);
    expect(find("restricted-export", routes)?.canActivate).toEqual([exportOnlySessionGuard]);
    expect(find("restricted-export", routes)?.component).toBe(RestrictedExportComponent);
  });
});
