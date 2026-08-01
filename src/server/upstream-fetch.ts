const CLIENT_CLOSED_REQUEST_STATUS = 499;

type UpstreamFetchOptions = {
  requestSignal?: AbortSignal;
  timeoutMs: number;
};

export function createUpstreamSignal(
  requestSignal: AbortSignal | undefined,
  timeoutMs: number,
) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  return requestSignal
    ? AbortSignal.any([requestSignal, timeoutSignal])
    : timeoutSignal;
}

export function fetchUpstream(
  input: RequestInfo | URL,
  init: RequestInit,
  { requestSignal, timeoutMs }: UpstreamFetchOptions,
) {
  return fetch(input, {
    ...init,
    signal: createUpstreamSignal(requestSignal, timeoutMs),
  });
}

export function createClientClosedResponse(headers?: HeadersInit) {
  return new Response(null, {
    status: CLIENT_CLOSED_REQUEST_STATUS,
    headers,
  });
}
