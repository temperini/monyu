import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const publicPages = [
  ["index.html", "https://www.monyu.com.br/"],
  ["como-funciona/index.html", "https://www.monyu.com.br/como-funciona/"],
  ["comparar-incentivos/index.html", "https://www.monyu.com.br/comparar-incentivos/"],
  ["incentivos/lei-do-bem/index.html", "https://www.monyu.com.br/incentivos/lei-do-bem/"],
  ["incentivos/lei-de-tics/index.html", "https://www.monyu.com.br/incentivos/lei-de-tics/"],
  [
    "incentivos/renuncia-fiscal-em-tecnologia/index.html",
    "https://www.monyu.com.br/incentivos/renuncia-fiscal-em-tecnologia/",
  ],
];

function readProjectFile(relativePath) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

test("páginas públicas mantêm metadados, dados estruturados e domínio canônico", () => {
  for (const [relativePath, canonicalUrl] of publicPages) {
    const html = readProjectFile(relativePath);
    assert.match(html, /<meta\s+name="description"/);
    assert.match(html, /<meta name="robots" content="index,follow/);
    assert.match(html, new RegExp(`rel="canonical" href="${canonicalUrl}"`));
    assert.match(html, /application\/ld\+json/);
  }
});

test("diagnóstico individual não é indexável", () => {
  const diagnosticHtml = readProjectFile("diagnostico/index.html");
  assert.match(diagnosticHtml, /name="robots" content="noindex,nofollow,noarchive,nosnippet"/);
  assert.match(diagnosticHtml, /src="\.\.\/script\.js" defer/);
  assert.match(diagnosticHtml, /href="\.\.\/styles\.css"/);
});

test("sitemap e robots expõem apenas a superfície pública", () => {
  const sitemap = readProjectFile("sitemap.xml");
  const robots = readProjectFile("robots.txt");
  const llms = readProjectFile("llms.txt");

  for (const [, canonicalUrl] of publicPages) {
    assert.match(sitemap, new RegExp(canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(sitemap, /diagnostico/);
  assert.match(robots, /Disallow: \/diagnostico\//);
  assert.match(robots, /User-agent: OAI-SearchBot/);
  assert.match(llms, /Não indexe, cite ou infira resultados individuais/);
});

test("links e ativos internos das páginas HTML existem", () => {
  const htmlFiles = [
    ...publicPages.map(([relativePath]) => relativePath),
    "diagnostico/index.html",
  ];

  for (const relativePath of htmlFiles) {
    const sourcePath = resolve(projectRoot, relativePath);
    const html = readFileSync(sourcePath, "utf8");
    const referencePattern = /(?:href|src)="([^"]+)"/g;

    for (const match of html.matchAll(referencePattern)) {
      const reference = match[1];
      if (/^(https?:|mailto:|tel:|#)/.test(reference)) continue;

      const pathOnly = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
      if (!pathOnly) continue;
      assert.ok(existsSync(resolve(dirname(sourcePath), pathOnly)), `${relativePath} aponta para ${reference}`);
    }
  }
});
