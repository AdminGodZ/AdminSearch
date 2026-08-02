import { renderToReadableStream } from "next/dist/compiled/react-server-dom-webpack/server.node.js";
import { cache, createElement } from "react";

let readCount = 0;
const observations = [];

const readPreferences = cache(async () => ({ requestNumber: ++readCount }));

async function PreferencesProbe() {
  const [first, second] = await Promise.all([
    readPreferences(),
    readPreferences(),
  ]);

  observations.push({
    requestNumber: first.requestNumber,
    sameReference: first === second,
  });

  return null;
}

async function renderRequest() {
  const stream = renderToReadableStream(createElement(PreferencesProbe), {});
  await stream.pipeTo(new WritableStream());
}

await renderRequest();
const readsAfterFirstRequest = readCount;
await renderRequest();

process.stdout.write(
  JSON.stringify({
    observations,
    readCount,
    readsAfterFirstRequest,
  }),
);
