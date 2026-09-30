export const GITHUB_LINK = "https://github.com/swissmakers/infra-w";
export const WEBSITE_LINK = "https://swissmakers.ch";
export const DOCUMENTATION_BASE = `${GITHUB_LINK}/tree/main/docs`;
export const documentationPage = (page) => `${GITHUB_LINK}/blob/main/docs/${encodeURIComponent(page)}.md`;
