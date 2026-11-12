// Minimal GitHub REST client for the review action.

const API = process.env.GITHUB_API_URL || "https://api.github.com";

export class GitHub {
  /** @param {string} token @param {string} repo "owner/name" */
  constructor(token, repo) {
    this.token = token;
    this.repo = repo;
  }

  async request(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`GitHub ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
      // @ts-ignore
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  async paginate(path) {
    const all = [];
    for (let page = 1; page <= 30; page += 1) {
      const sep = path.includes("?") ? "&" : "?";
      const items = await this.request("GET", `${path}${sep}per_page=100&page=${page}`);
      all.push(...items);
      if (items.length < 100) break;
    }
    return all;
  }

  pull(n) {
    return this.request("GET", `/repos/${this.repo}/pulls/${n}`);
  }

  files(n) {
    return this.paginate(`/repos/${this.repo}/pulls/${n}/files`);
  }

  reviewComments(n) {
    return this.paginate(`/repos/${this.repo}/pulls/${n}/comments`);
  }

  reviews(n) {
    return this.paginate(`/repos/${this.repo}/pulls/${n}/reviews`);
  }

  createReview(n, review) {
    return this.request("POST", `/repos/${this.repo}/pulls/${n}/reviews`, review);
  }
}
