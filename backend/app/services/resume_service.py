import re
import uuid
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "resumes"
MAX_BYTES = 5 * 1024 * 1024
PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
ALLOWED = {PDF_MIME, DOCX_MIME}

_SPEC_LABELS = {
    "backend": ("BACKEND DEVELOPER", "Backend-разработчик"),
    "frontend": ("FRONTEND DEVELOPER", "Frontend-разработчик"),
    "fullstack": ("FULLSTACK DEVELOPER", "Fullstack-разработчик"),
    "devops": ("DEVOPS ENGINEER", "DevOps-инженер"),
    "data": ("DATA ENGINEER", "Data-инженер"),
    "qa": ("QA ENGINEER", "QA-инженер"),
    "mobile": ("MOBILE DEVELOPER", "Mobile-разработчик"),
}


def _guess_content_type(filename: str | None, declared: str | None, raw: bytes) -> str | None:
    name = (filename or "").lower()
    declared = (declared or "").split(";")[0].strip().lower()
    if declared in ALLOWED:
        return declared
    if name.endswith(".pdf") or raw[:4] == b"%PDF":
        return PDF_MIME
    if name.endswith(".docx") or (len(raw) >= 2 and raw[:2] == b"PK"):
        if name.endswith(".docx") or declared in ("application/octet-stream", "application/zip", ""):
            return DOCX_MIME
    return None


def save_resume(file: UploadFile) -> tuple[str, str, str, str]:
    raw = file.file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "Файл больше 5 МБ")
    ctype = _guess_content_type(file.filename, file.content_type, raw)
    if ctype not in ALLOWED:
        raise HTTPException(400, "Допустимы только PDF и DOCX")
    ext = ".pdf" if ctype == PDF_MIME else ".docx"
    key = f"{uuid.uuid4().hex}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / key
    path.write_bytes(raw)
    text = extract_text(raw, ctype)
    return key, file.filename or key, ctype, text


def extract_text(raw: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(raw))
            parts = [p.extract_text() or "" for p in reader.pages[:20]]
            return "\n".join(parts).strip()
        except Exception:
            return ""
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            from docx import Document

            doc = Document(BytesIO(raw))
            return "\n".join(p.text for p in doc.paragraphs).strip()
        except Exception:
            return ""
    return ""


def docx_preview_html(raw: bytes) -> str:
    text = extract_text(raw, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    safe = re.sub(r"[<>&]", " ", text)
    return f"<html><body style='font-family:sans-serif;padding:1rem'>{safe}</body></html>"


def delete_storage(key: str | None) -> None:
    if not key:
        return
    path = UPLOAD_DIR / key
    if path.is_file():
        path.unlink()


def _register_pdf_fonts() -> tuple[str, str]:
    """Возвращает (regular, bold) — с кириллицей, если шрифты найдены."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    pairs = (
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ),
        ("/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"),
        ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
        ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf"),
    )
    for regular, bold in pairs:
        try:
            pdfmetrics.registerFont(TTFont("ProfileFont", regular))
            pdfmetrics.registerFont(TTFont("ProfileFontBold", bold))
            return "ProfileFont", "ProfileFontBold"
        except Exception:
            continue
    return "Helvetica", "Helvetica-Bold"


def _rgb_tuple(r: float, g: float, b: float):
    from reportlab.lib.colors import Color

    return Color(r, g, b)


def _hex_to_color(n: int):
    from reportlab.lib.colors import Color

    return Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)


def _stack_tags(stack: str | None) -> list[str]:
    return [t.strip() for t in re.split(r"[,;|/]+", stack or "") if t.strip()][:12]


def _experience_blocks(resume_text: str | None) -> list[tuple[str, str, str]]:
    """Грубо разбирает resume_text на блоки (title, dates, body)."""
    raw = (resume_text or "").strip()
    if not raw:
        return []
    chunks = [c.strip() for c in re.split(r"\n\s*\n", raw) if c.strip()]
    out: list[tuple[str, str, str]] = []
    date_re = re.compile(
        r"(?P<dates>(?:\d{4}|\d{2}\.\d{4})\s*[—–\-]\s*(?:\d{4}|\d{2}\.\d{4}|н\.?\s*в\.?|настоящее))",
        re.I,
    )
    for chunk in chunks[:6]:
        lines = [ln.strip() for ln in chunk.splitlines() if ln.strip()]
        if not lines:
            continue
        title = lines[0][:90]
        dates = ""
        body_lines = lines[1:]
        m = date_re.search(title)
        if m:
            dates = m.group("dates")
            title = (title[: m.start()] + title[m.end() :]).strip(" ·|-—–") or title
        elif body_lines:
            m2 = date_re.search(body_lines[0])
            if m2 and len(body_lines[0]) < 40:
                dates = m2.group("dates")
                body_lines = body_lines[1:]
        body = " ".join(body_lines)[:420]
        out.append((title, dates, body))
    return out


def generate_profile_pdf(candidate) -> bytes:
    """PDF-резюме в макете InviteMatch (двухколоночный шаблон)."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.utils import simpleSplit
        from reportlab.pdfbase.pdfmetrics import stringWidth
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise HTTPException(500, "reportlab не установлен") from exc

    font, font_bold = _register_pdf_fonts()

    # Цвета из InviteMatch_resume_template.pdf
    page_bg = _rgb_tuple(0.9686, 0.9804, 0.9882)
    sidebar = _rgb_tuple(0.0627, 0.1412, 0.2275)
    sidebar_card = _rgb_tuple(0.0980, 0.2157, 0.3137)
    teal = _rgb_tuple(0.0314, 0.4980, 0.5490)
    white = _hex_to_color(0xFFFFFF)
    muted_side = _hex_to_color(0xB8C8DA)
    ink = _hex_to_color(0x172C3D)
    muted = _hex_to_color(0x606887)
    line = _rgb_tuple(0.8471, 0.8902, 0.9176)
    confirm_bg = _rgb_tuple(0.9176, 0.9569, 0.9647)

    page_w, page_h = A4
    side_w = 178.0
    main_x = 209.0
    main_right = page_w - 31.0
    main_w = main_right - main_x

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Резюме — {candidate.full_name or 'Кандидат'}")
    c.setAuthor("InviteMatch")

    # Фон
    c.setFillColor(page_bg)
    c.rect(0, 0, page_w, page_h, fill=1, stroke=0)
    c.setFillColor(sidebar)
    c.rect(0, 0, side_w, page_h, fill=1, stroke=0)

    # --- Sidebar ---
    # Logo badge
    c.setFillColor(teal)
    c.roundRect(25, page_h - 49, 28, 28, 4, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(font_bold, 12)
    c.drawCentredString(39, page_h - 40.5, "IM")
    c.setFont(font_bold, 11)
    c.drawString(62, page_h - 39.5, "INVITEMATCH")

    c.setFillColor(muted_side)
    c.setFont(font, 7)
    c.drawString(25, page_h - 68, "ПРОВЕРЕННЫЙ ПРОФИЛЬ КАНДИДАТА")

    # Test result card
    card_y = page_h - 169
    c.setFillColor(sidebar_card)
    c.roundRect(20, card_y, 138, 72, 8, fill=1, stroke=0)
    c.setFillColor(muted_side)
    c.setFont(font_bold, 7)
    c.drawString(31, card_y + 52, "РЕЗУЛЬТАТ ТЕСТА")
    score = candidate.test_score
    score_txt = f"{score:.0f}%" if score is not None else "—"
    c.setFillColor(white)
    c.setFont(font_bold, 27)
    c.drawString(30, card_y + 18, score_txt)
    if score is not None:
        c.setFillColor(teal)
        c.roundRect(106, card_y + 23, 39, 19, 4, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(font_bold, 7)
        c.drawCentredString(125.5, card_y + 29.5, "ПРОВЕРЕНО")

    def side_section(title: str, y: float) -> float:
        c.setFillColor(teal)
        c.rect(25, y - 1, 4, 12, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(font_bold, 8)
        c.drawString(37, y, title)
        return y - 18

    y = page_h - 198
    y = side_section("КОНТАКТЫ", y)

    def contact_pair(label: str, value: str, yy: float) -> float:
        c.setFillColor(muted_side)
        c.setFont(font, 7)
        c.drawString(25, yy, label)
        c.setFillColor(white)
        c.setFont(font_bold, 8)
        c.drawString(25, yy - 14, value[:28] if value else "—")
        return yy - 30

    phone = (candidate.phone or "").strip() or "—"
    tg_raw = (candidate.telegram or "").strip()
    if tg_raw and not tg_raw.startswith("@"):
        tg_raw = f"@{tg_raw}"
    telegram = tg_raw or "—"
    city = (candidate.city or "").strip() or "—"

    y = contact_pair("Город", city, y)
    y = contact_pair("Телефон", phone, y)
    y = contact_pair("Telegram", telegram, y)

    y -= 8
    y = side_section("ТЕХНОЛОГИИ", y)

    tags = _stack_tags(candidate.stack)
    if not tags:
        c.setFillColor(muted_side)
        c.setFont(font, 7)
        c.drawString(25, y, "Стек не указан")
        y -= 20
    else:
        # Две колонки «таблеток»
        col_w = 63
        gap = 6
        row_h = 26
        for i, tag in enumerate(tags[:8]):
            col = i % 2
            row = i // 2
            tx = 25 + col * (col_w + gap)
            ty = y - row * row_h - 20
            c.setFillColor(sidebar_card)
            c.roundRect(tx, ty, col_w, 20, 4, fill=1, stroke=0)
            c.setFillColor(white)
            c.setFont(font_bold, 7)
            label = tag if stringWidth(tag, font_bold, 7) <= col_w - 10 else tag[:10] + "…"
            c.drawCentredString(tx + col_w / 2, ty + 6.5, label)
        rows = (min(len(tags), 8) + 1) // 2
        y -= rows * row_h + 8

    y -= 6
    y = side_section("ФСП", y)
    c.setFillColor(muted_side)
    c.setFont(font, 7)
    c.drawString(25, y, "Индекс достижений")
    fsp_val = f"{float(candidate.fsp_score):.1f}" if candidate.has_fsp_history else "—"
    c.setFillColor(white)
    c.setFont(font_bold, 19)
    c.drawString(25, y - 24, fsp_val)
    c.setFillColor(muted_side)
    c.setFont(font, 6.7)
    note = (
        "Достижения подтверждены платформой"
        if candidate.has_fsp_history
        else "История ФСП ещё не подтверждена"
    )
    c.drawString(25, y - 38, note[:42])

    # Verified badge under ФСП (как в макете)
    badge_y = y - 50
    c.setFillColor(teal)
    c.circle(30, badge_y + 3.5, 5, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(font_bold, 7)
    c.drawString(41, badge_y, "Подтверждённый профиль")

    # --- Main column ---
    spec_key = candidate.specialization.value if candidate.specialization else None
    grade = candidate.confirmed_grade or candidate.selected_grade
    grade_s = grade.value.upper() if grade else "—"
    role_en, role_ru = _SPEC_LABELS.get(spec_key or "", ("КАНДИДАТ", "Кандидат"))
    eyebrow = f"{role_en}  /  {grade_s}"
    full_name = (candidate.full_name or "Кандидат").strip()

    # accent bar
    c.setFillColor(teal)
    c.rect(main_x, page_h - 49, 38, 4, fill=1, stroke=0)

    c.setFillColor(teal)
    c.setFont(font_bold, 7)
    c.drawString(main_x, page_h - 69, eyebrow)

    c.setFillColor(ink)
    c.setFont(font_bold, 24)
    name_lines = simpleSplit(full_name, font_bold, 24, main_w)
    ny = page_h - 98
    for line_txt in name_lines[:2]:
        c.drawString(main_x, ny, line_txt)
        ny -= 26

    c.setFillColor(muted)
    c.setFont(font, 9)
    c.drawString(main_x, ny - 4, role_ru)

    def section_header(title: str, yy: float, right: str | None = None) -> float:
        c.setStrokeColor(line)
        c.setLineWidth(0.7)
        c.line(main_x, yy + 14, main_right, yy + 14)
        c.setFillColor(teal)
        c.setFont(font_bold, 9)
        c.drawString(main_x, yy, title)
        if right:
            c.setFillColor(muted)
            c.setFont(font, 7)
            c.drawRightString(main_right, yy + 1, right)
        return yy - 18

    my = ny - 40
    my = section_header("О СЕБЕ", my)

    about = (candidate.about or "").strip()
    if not about:
        about = "Кратко расскажите о специализации, сильных сторонах и профессиональной цели."
    c.setFillColor(ink)
    c.setFont(font, 8)
    for line_txt in simpleSplit(about[:700], font, 8, main_w)[:6]:
        c.drawString(main_x, my, line_txt)
        my -= 12

    my -= 14
    my = section_header("ОПЫТ И ПРОЕКТЫ", my)

    experiences = _experience_blocks(candidate.resume_text)
    if not experiences:
        experiences = [
            (
                "Опыт из профиля",
                "",
                (candidate.resume_text or "").strip()[:420]
                or "Добавьте текст резюме в профиле — здесь появятся проекты и опыт.",
            )
        ]

    for title, dates, body in experiences[:4]:
        if my < 120:
            break
        c.setFillColor(teal)
        c.circle(main_x + 2.5, my + 3, 2.4, fill=1, stroke=0)
        c.setFillColor(ink)
        c.setFont(font_bold, 8.2)
        title_w = main_w - (stringWidth(dates, font, 6.8) + 12 if dates else 0)
        title_draw = title
        while stringWidth(title_draw, font_bold, 8.2) > title_w and len(title_draw) > 3:
            title_draw = title_draw[:-2] + "…"
        c.drawString(main_x + 12, my, title_draw)
        if dates:
            c.setFillColor(muted)
            c.setFont(font, 6.8)
            c.drawRightString(main_right, my, dates)
        my -= 14
        c.setFillColor(muted)
        c.setFont(font, 7.4)
        for line_txt in simpleSplit(body or "—", font, 7.4, main_w)[:3]:
            c.drawString(main_x, my, line_txt)
            my -= 11
        my -= 8

    # Confirmation block
    if my > 140:
        my -= 4
        my = section_header("ПОДТВЕРЖДЕНИЕ INVITEMATCH", my)
        box_h = 42
        box_y = my - box_h + 8
        c.setFillColor(confirm_bg)
        c.roundRect(main_x, box_y, main_w, box_h, 6, fill=1, stroke=0)
        cx, cy = main_x + 15, box_y + box_h / 2
        c.setFillColor(teal)
        c.circle(cx, cy, 6, fill=1, stroke=0)
        c.setStrokeColor(white)
        c.setLineWidth(1.4)
        c.line(cx - 3, cy, cx - 0.5, cy - 2.5)
        c.line(cx - 0.5, cy - 2.5, cx + 3.5, cy + 2.5)
        c.setFillColor(ink)
        c.setFont(font_bold, 7.5)
        c.drawString(main_x + 28, box_y + 24, "Достижения ФСП подтверждены")
        c.setFillColor(muted)
        c.setFont(font, 6.8)
        c.drawString(main_x + 28, box_y + 12, "Результат теста и индекс ФСП — данные платформы")

    # Footer
    c.setStrokeColor(line)
    c.setLineWidth(0.7)
    c.line(main_x, 44, main_right, 44)
    c.setFillColor(muted)
    c.setFont(font, 6.5)
    c.drawString(main_x, 30, "InviteMatch  ·  Проверяемые навыки и достижения")
    c.setFillColor(teal)
    c.setFont(font_bold, 6.5)
    c.drawRightString(main_right, 30, "РЕЗЮМЕ КАНДИДАТА")

    c.showPage()
    c.save()
    return buf.getvalue()
