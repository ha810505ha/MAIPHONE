/* global window, document, location, history, navigator, URL, URLSearchParams */
// 公開法律頁（隱私權政策、服務條款）共用的渲染與語言切換。
// 內容放在 privacy-content.js / terms-content.js，格式：
//   window.MALI_LEGAL = { doc: "privacy" | "terms", content: { [lang]: { title, updated, intro[], summary?[], sections: [{ h, blocks }] } } }
//   block: { p: "..." } | { ul: ["..."] } | { table: { head: [...], rows: [[...]] } }
// 內容字串可含受控的 HTML（<a>、<strong>），由本專案撰寫，不接受外部輸入。
(function () {
  var ORDER = ["zh-TW", "zh-CN", "en", "ja", "ko"];
  var LANG_LABEL = { "zh-TW": "繁中", "zh-CN": "简中", en: "EN", ja: "日本語", ko: "한국어" };
  var DOC_LABEL = {
    privacy: { "zh-TW": "隱私權政策", "zh-CN": "隐私政策", en: "Privacy Policy", ja: "プライバシーポリシー", ko: "개인정보 처리방침" },
    terms: { "zh-TW": "服務條款", "zh-CN": "服务条款", en: "Terms of Service", ja: "利用規約", ko: "이용약관" },
  };
  var data = window.MALI_LEGAL;

  function pickLang() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q && data.content[q]) return q;
    var nav = (navigator.language || "").toLowerCase();
    if (nav.indexOf("zh") === 0) return /cn|sg|hans/.test(nav) ? "zh-CN" : "zh-TW";
    if (nav.indexOf("ja") === 0) return "ja";
    if (nav.indexOf("ko") === 0) return "ko";
    if (nav.indexOf("en") === 0) return "en";
    return "zh-TW";
  }

  function block(b) {
    if (b.p) return "<p>" + b.p + "</p>";
    if (b.ul) return "<ul>" + b.ul.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>";
    if (b.table) {
      var head = "<tr>" + b.table.head.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr>";
      var rows = b.table.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("");
      return "<div class=\"table-wrap\"><table>" + head + rows + "</table></div>";
    }
    return "";
  }

  function render(lang) {
    var d = data.content[lang];
    document.documentElement.lang = lang;
    document.title = d.title;
    var html = "<h1>" + d.title + "</h1><p class=\"updated\">" + d.updated + "</p>";
    html += (d.intro || []).map(function (p) { return "<p>" + p + "</p>"; }).join("");
    if (d.summary) html += "<div class=\"summary\"><ul>" + d.summary.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul></div>";
    d.sections.forEach(function (s) { html += "<h2>" + s.h + "</h2>" + s.blocks.map(block).join(""); });
    document.getElementById("doc").innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll("#langs button"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    var docs = document.getElementById("docs");
    docs.innerHTML = "";
    ["privacy", "terms"].forEach(function (key) {
      var a = document.createElement("a");
      a.href = "./" + key + "?lang=" + encodeURIComponent(lang);
      a.textContent = DOC_LABEL[key][lang];
      if (key === data.doc) a.setAttribute("aria-current", "page");
      docs.appendChild(a);
    });
  }

  var langs = document.getElementById("langs");
  ORDER.forEach(function (code) {
    var b = document.createElement("button");
    b.type = "button";
    b.dataset.lang = code;
    b.textContent = LANG_LABEL[code];
    b.addEventListener("click", function () {
      var url = new URL(location.href);
      url.searchParams.set("lang", code);
      history.replaceState(null, "", url);
      render(code);
    });
    langs.appendChild(b);
  });
  render(pickLang());
})();
