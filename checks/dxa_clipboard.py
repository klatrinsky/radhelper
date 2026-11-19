"""Run from the repository root with Playwright and its Chromium installed."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright


def check(page, url):
    page.goto(url)
    page.locator("#q").fill("денситометрия")
    form = page.locator("#study .tpl")
    field = lambda name: form.locator(f'input[data-name="{name}"]:visible')
    copy = page.locator("#study .copy")

    def copied_sections():
        page.evaluate("navigator.clipboard.writeText('')")
        copy.click()
        if copy.inner_text() == "Всё равно скопировать":
            copy.click()
        page.wait_for_function("async () => Boolean(await navigator.clipboard.readText())")
        text = page.evaluate("navigator.clipboard.readText()")
        body, conclusion = text.split("Заключение:")
        return body, conclusion.split("Рекомендации:")[0]

    for name, value in {"Возраст": "68", "T позв": "-2", "T% позв": "78",
                        "Z позв": "-1", "Z% позв": "91", "T шейка 1": "-1",
                        "T% шейка 1": "83", "Z шейка 1": "0", "Z% шейка 1": "95"}.items():
        field(name).fill(value)
    body, conclusion = copied_sections()
    assert "78%" in body and "91%" in body
    assert "предыдущ" not in (body + conclusion).lower()
    print("PASS primary")

    form.get_by_text("Первичное исследование", exact=True).click()
    form.locator('input[placeholder="дд.мм.гггг"]:visible').first.fill("13.03.2025")
    previous = field("было позв")
    previous.fill("68")
    field("было шейка 1").fill("83")
    body, conclusion = copied_sections()
    assert all(s in body for s in ("13.03.2025", "T-критерий", "68%"))
    assert "T-критерия на 10%" in conclusion and "68%" not in conclusion
    print("PASS follow-up T")

    form.get_by_text("наступила", exact=True).click()
    expect(form.locator(".ctl").first).to_contain_text("Z-критерий", use_inner_text=True)
    expect(previous).to_have_value("")
    body, _ = copied_sections()
    assert "Z-критерий" in body and "68%" not in body
    previous.fill("96")
    field("было шейка 1").fill("95")
    body, conclusion = copied_sections()
    assert "96%" in body and "68%" not in body
    assert "снижения значений Z-критерия на 5%" in conclusion
    assert "96%" not in conclusion and "T-критерия" not in conclusion
    print("PASS switch T to Z")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server, sync_playwright() as pw:
        Thread(target=server.serve_forever, daemon=True).start()
        browser = pw.chromium.launch()
        page = browser.new_context(permissions=["clipboard-read", "clipboard-write"]).new_page()
        try:
            check(page, f"http://127.0.0.1:{server.server_port}/")
        finally:
            browser.close()
            server.shutdown()
