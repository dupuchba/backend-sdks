interface APICall<Response> {
  call(request: Request): Promise<Response>;
}

class BrowserHTTPClient implements APICall<Response> {
  call(request: Request): Promise<Response> {
    return fetch(request);
  }
}

class RoamBackendClient {
  //static #baseUrl = 'https://peer-2.api.roamresearch.com:3004';
  static #baseUrl = 'https://api.roamresearch.com';
  //static #baseUrl = "http://localhost:3000";
  #token: string;
  #peer: string;
  #httpClient: APICall<Response>;
  readonly graph: string;
  constructor(token: string, graph: string, httpClient: APICall<Response>) {
    this.#token = token;
    this.graph = graph;
    this.#httpClient = httpClient;
  }

  async api(path: string, method: string, body: object): Promise<Response> {
    const req = this.makeRequest(path, method, body);
    const response = await this.#httpClient.call(req);
    if (response.redirected) {
      const re = /(https:\/\/peer-\d+.*?:\d+)\/.*/;
      const regexpResult = response.url.match(re);
      if (regexpResult?.length == 2) {
        this.#peer = regexpResult[1];
      }
    }

    switch (response.status) {
      case 200:
        break;
      case 500:
      case 400:
        throw new Error(
          "Error: " + (await response.json()).message ??
            "HTTP " + response.status
        );
      case 401:
        throw new Error(
          "Invalid token or token doesn't have enough privileges."
        );
      case 503:
        throw new Error(
          "HTTP Status: 503. Your graph is not ready yet for a request, please retry in a few seconds."
        );
      default:
        throw new Error(response.statusText);
    }
    return response;
  }

  private makeRequest(path: string, method = "POST", body: object): Request {
    const baseUrl = this.#peer ?? RoamBackendClient.#baseUrl;
    return new Request(baseUrl + path, {
      method: method,
      mode: "cors",
      cache: "no-cache",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${this.#token}`,
        "x-authorization": `Bearer ${this.#token}`,
      },
    });
  }
}

export async function q(
  app: RoamBackendClient,
  query: string,
  args?: string[]
): Promise<any> {
  const path = `/api/graph/${app.graph}/q`;
  let body;
  if (args) {
    body = {
      query: query,
      args: args,
    };
  } else {
    body = { query: query };
  }
  const resp = await app.api(path, "POST", body);
  const { result } = await resp.json();
  return result;
}

export async function pull(
  app: RoamBackendClient,
  pattern: string,
  eid: string
): Promise<any> {
  const path = `/api/graph/${app.graph}/pull`;
  const body = {
    eid: eid,
    selector: pattern,
  };
  const resp = await app.api(path, "POST", body);
  const { result } = await resp.json();
  return result;
}

type RoamBlockLocation = {
  "parent-uid": string;
  order: number | string;
};

type RoamBlock = {
  string: string;
  uid?: string;
  open?: boolean;
  heading?: number;
  "text-align"?: boolean;
  "children-view-type"?: string;
};

type RoamCreateBlock = {
  action?: "create-block";
  location: RoamBlockLocation;
  block: RoamBlock;
};

export async function createBlock(
  app: RoamBackendClient,
  body: RoamCreateBlock
): Promise<boolean> {
  body.action = "create-block";
  const path = `/api/graph/${app.graph}/write`;
  const response = await app.api(path, "POST", body);
  return response.ok;
}

type RoamMoveBlock = {
  action?: "move-block";
  location: RoamBlockLocation;
  block: {
    uid: RoamBlock["uid"];
  };
};

export async function moveBlock(
  app: RoamBackendClient,
  body: RoamMoveBlock
): Promise<boolean> {
  body.action = "move-block";
  const path = `/api/graph/${app.graph}/write`;
  const response = await app.api(path, "POST", body);
  return response.ok;
}

type RoamUpdateBlock = {
  action?: "update-block";
  block: {
    string?: string;
    uid: string;
    open?: boolean;
    heading?: number;
    "text-align"?: boolean;
    "children-view-type"?: string;
  };
};

export async function updateBlock(
  app: RoamBackendClient,
  body: RoamUpdateBlock
): Promise<boolean> {
  body.action = "update-block";
  const path = `/api/graph/${app.graph}/write`;
  const response = await app.api(path, "POST", body);
  return response.ok;
}

type RoamDeleteBlock = {
  action?: "delete-block";
  block: {
    uid: string;
  };
};

export async function deleteBlock(
  app: RoamBackendClient,
  body: RoamDeleteBlock
): Promise<boolean> {
  body.action = "delete-block";
  const path = `/api/graph/${app.graph}/write`;
  const response = await app.api(path, "POST", body);
  return response.ok;
}

type RoamCreatePage = {
  action?: "create-page";
  page: {
    title: string;
    uid?: string;
    "children-view-type"?: string;
  };
};

export async function createPage(
  app: RoamBackendClient,
  body: RoamCreatePage
): Promise<boolean> {
  body.action = "create-page";
  const path = `/api/graph/${app.graph}/write`;
  const response = await app.api(path, "POST", body);
  return response.ok;
}

type RoamUpdatePage = {
  action?: "update-page";
  page: {
    title?: string;
    uid: string;
    "children-view-type"?: string;
  };
};

export async function updatePage(
  app: RoamBackendClient,
  body: RoamUpdatePage
): Promise<boolean> {
  body.action = "update-page";
  const path = `/api/graph/${app.graph}/write`;
  const response = await app.api(path, "POST", body);
  return response.ok;
}

type RoamDeletePage = {
  action?: "delete-page";
  page: {
    uid: string;
  };
};

export async function deletePage(
  app: RoamBackendClient,
  body: RoamDeletePage
): Promise<boolean> {
  body.action = "delete-page";
  const path = `/api/graph/${app.graph}/write`;
  const response = await app.api(path, "POST", body);
  return response.ok;
}

type InitGraph = {
  graph: string;
  token: string;
  httpClient?: APICall<Response>;
};

export function initializeGraph(config: InitGraph) {
  if (config.httpClient == null) {
    config.httpClient = new BrowserHTTPClient();
  }
  return new RoamBackendClient(config.token, config.graph, config.httpClient);
}

// const graph = initializeGraph({
//   token: "",
//   graph: "Clojuredart",
// });

// client.createBlock({"location": {"parent-uid": "01-02-2023", "order": "last"}, "block": {"string": "coucou"}});
// q(
//   graph,
//   "[:find ?block-uid ?block-str :in $ ?search-string :where [?b :block/uid ?block-uid] [?b :block/string ?block-str] [(clojure.string/includes? ?block-str ?search-string)]]",
//   ["apple"]
// ).then((r) => {
//   console.log(r);
// });

// (q {:token ""
//     :graph "Clojuredart"}
//   "[:find ?block-uid ?block-str :in $ ?search-string :where [?b :block/uid ?block-uid] [?b :block/string ?block-str] [(clojure.string/includes? ?block-str ?search-string)]]"
//   "apple")
// createBlock(graph, {
//   location: { "parent-uid": "01-02-2023", order: "last" },
//   block: { string: "coucou" },
// }).then((r) => {
//   console.log(r);
// });

//client.pull(
//  "[:block/uid :node/title :block/string {:block/children [:block/uid :block/string]} {:block/refs [:node/title :block/string :block/uid]}]",
//  "[:block/uid \"08-30-2022\"]",).then((r) => {
//  console.log(r);
//});

// docker run -p 4000:4000 -w "/usr/roam" -v "$PWD:/usr/roam" -it node:18.12.1 /bin/sh
// npm run develop

// const graph = initializeGraph({graph: Clojuredart, token: ...});
// q(graph, "", "");;

// npx prettier --write .
