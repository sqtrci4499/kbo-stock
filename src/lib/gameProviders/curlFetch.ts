/**
 * KBO 공식 사이트 요청 시 시스템 curl을 사용하는 헬퍼.
 *
 * [왜 필요한가]
 * koreabaseball.com은 Node.js의 내장 fetch(undici)로 요청하면 ASP.NET_SessionId
 * 쿠키가 없는, 훨씬 축소된 페이지(14KB)를 반환합니다. 반면 동일한 PC/네트워크에서
 * curl로 요청하면 정상 페이지(51KB, 세션 쿠키 포함)를 받습니다. 이는 TLS 핸드셰이크
 * 지문(fingerprint)으로 클라이언트 종류를 구분하는 WAF/방화벽 때문으로 추정되며,
 * 실제로 확인된 현상입니다 (2026-07-02, 사용자 환경에서 재현됨).
 *
 * Node.js 코드로는 이 차이를 우회하기 어렵기 때문에, 이미 정상 동작이 확인된
 * 시스템 curl 바이너리를 그대로 호출하는 방식을 사용합니다.
 *
 * [배포 환경 제약 — 중요]
 * 이 방식은 실행 환경에 curl 바이너리가 있어야 동작합니다.
 *   - 로컬 개발 PC(Windows/Mac/Linux): 대부분 curl 기본 내장 → 문제 없음
 *   - 일반 VPS/전용 서버(Node.js 직접 실행): curl 보통 기본 설치되어 있음 → 문제 없음
 *   - Vercel 서버리스 함수: curl 바이너리가 없을 수 있어 동작하지 않을 가능성이 있습니다.
 *     Vercel에 배포할 경우 이 부분이 실패하면, 대안으로 Playwright/Puppeteer 기반
 *     헤드리스 브라우저 방식(진짜 브라우저 TLS 지문을 사용하므로 더 안정적이지만
 *     무겁고 별도 설정 필요)으로 교체하는 걸 검토해야 합니다.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CURL_TIMEOUT_SEC = 10;

export interface CurlGetResult {
  status: number;
  headers: Record<string, string[]>; // 값이 여러 개일 수 있어 배열로 보관 (Set-Cookie 대비)
  body: string;
}

/**
 * curl -i 로 GET 요청을 보내고 헤더+본문을 파싱해서 반환한다.
 * (헤더를 Node fetch가 아닌 curl 자체 출력에서 파싱하므로 Set-Cookie 다중 헤더도 안전함)
 */
export async function curlGet(url: string, extraHeaders: Record<string, string> = {}): Promise<CurlGetResult | null> {
  const args = ["-s", "-i", "--max-time", String(CURL_TIMEOUT_SEC)];
  for (const [k, v] of Object.entries(extraHeaders)) {
    args.push("-H", `${k}: ${v}`);
  }
  args.push(url);

  try {
    const { stdout } = await execFileAsync("curl", args, { maxBuffer: 20 * 1024 * 1024 });
    return parseCurlIncludeOutput(stdout);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[curlFetch] ❌ curl GET 실행 실패: ${msg} (curl 바이너리가 없는 환경일 수 있습니다)`);
    return null;
  }
}

/** curl로 POST(form-urlencoded)를 보내고 본문(JSON 문자열)만 반환한다. */
export async function curlPost(url: string, formData: string, extraHeaders: Record<string, string> = {}): Promise<string | null> {
  const args = ["-s", "--max-time", String(CURL_TIMEOUT_SEC), "-X", "POST", "--data", formData];
  for (const [k, v] of Object.entries(extraHeaders)) {
    args.push("-H", `${k}: ${v}`);
  }
  args.push(url);

  try {
    const { stdout } = await execFileAsync("curl", args, { maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[curlFetch] ❌ curl POST 실행 실패: ${msg} (curl 바이너리가 없는 환경일 수 있습니다)`);
    return null;
  }
}

/** `curl -i` 출력(상태줄+헤더+빈줄+본문)을 파싱한다. */
function parseCurlIncludeOutput(raw: string): CurlGetResult {
  // curl -i는 리다이렉트를 따라가지 않는 이상 헤더 블록 1개만 출력한다 (여기선 -L을 안 썼으므로 1개).
  const sepIndex = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") : raw.indexOf("\n\n");
  const sepLen = raw.indexOf("\r\n\r\n") !== -1 ? 4 : 2;
  const headerBlock = sepIndex !== -1 ? raw.slice(0, sepIndex) : raw;
  const body = sepIndex !== -1 ? raw.slice(sepIndex + sepLen) : "";

  const lines = headerBlock.split(/\r?\n/);
  const statusLine = lines[0] ?? "";
  const statusMatch = statusLine.match(/HTTP\/[\d.]+\s+(\d+)/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

  const headers: Record<string, string[]> = {};
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (!headers[key]) headers[key] = [];
    headers[key].push(val);
  }

  return { status, headers, body };
}
