const assert = require("node:assert/strict");
const test = require("node:test");
const { textToOutreachHtml } = require("./outreach-html.ts");

test("textToOutreachHtml escapes unsafe characters", () => {
  assert.equal(
    textToOutreachHtml(`Hi <owner> & "team"'`),
    "<p>Hi &lt;owner&gt; &amp; &quot;team&quot;&#39;</p>",
  );
});

test("textToOutreachHtml linkifies http and https URLs", () => {
  assert.equal(
    textToOutreachHtml("Demo: https://latchlyai.com/demos/acme."),
    '<p>Demo: <a href="https://latchlyai.com/demos/acme">https://latchlyai.com/demos/acme</a>.</p>',
  );
});

test("textToOutreachHtml preserves paragraph and line breaks", () => {
  assert.equal(
    textToOutreachHtml("Line one\nLine two\n\nLine three"),
    "<p>Line one<br>\nLine two</p>\n<p>Line three</p>",
  );
});

test("textToOutreachHtml preserves links inside escaped text", () => {
  assert.equal(
    textToOutreachHtml("Use <this> https://example.com?a=1&b=2"),
    '<p>Use &lt;this&gt; <a href="https://example.com?a=1&amp;b=2">https://example.com?a=1&amp;b=2</a></p>',
  );
});
