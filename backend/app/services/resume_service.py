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
        ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
        ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf"),
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ),
        ("/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"),
    )
    for regular, bold in pairs:
        try:
            pdfmetrics.registerFont(TTFont("ProfileFont", regular))
            pdfmetrics.registerFont(TTFont("ProfileFontBold", bold))
            return "ProfileFont", "ProfileFontBold"
        except Exception:
            continue
    return "Helvetica", "Helvetica-Bold"


def _esc(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _paragraphs(text: str, style, limit: int = 6000):
    from reportlab.platypus import Paragraph, Spacer

    raw = (text or "").strip()[:limit]
    if not raw:
        return [Paragraph("—", style)]
    blocks = []
    for chunk in re.split(r"\n\s*\n", raw):
        line = " ".join(chunk.split())
        if line:
            blocks.append(Paragraph(_esc(line), style))
            blocks.append(Spacer(1, 4))
    return blocks or [Paragraph("—", style)]


def generate_profile_pdf(candidate) -> bytes:
    """Профессиональный PDF-профиль из структурированных полей кандидата."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            HRFlowable,
            KeepTogether,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError as exc:
        raise HTTPException(500, "reportlab не установлен") from exc

    font, font_bold = _register_pdf_fonts()

    brand = colors.HexColor("#0e7490")
    brand_dark = colors.HexColor("#155e75")
    ink = colors.HexColor("#0b1524")
    muted = colors.HexColor("#5a6a7c")
    line = colors.HexColor("#c9d5e3")
    soft = colors.HexColor("#f0f7fa")

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Резюме — {candidate.full_name or 'Кандидат'}",
        author="InviteMatch",
    )

    name_style = ParagraphStyle(
        "CvName",
        fontName=font_bold,
        fontSize=22,
        leading=26,
        textColor=ink,
        spaceAfter=2,
    )
    role_style = ParagraphStyle(
        "CvRole",
        fontName=font,
        fontSize=11,
        leading=14,
        textColor=brand_dark,
        spaceAfter=6,
    )
    contact_style = ParagraphStyle(
        "CvContact",
        fontName=font,
        fontSize=9,
        leading=12,
        textColor=muted,
    )
    section_style = ParagraphStyle(
        "CvSection",
        fontName=font_bold,
        fontSize=11,
        leading=14,
        textColor=brand_dark,
        spaceBefore=10,
        spaceAfter=4,
        alignment=TA_LEFT,
    )
    body_style = ParagraphStyle(
        "CvBody",
        fontName=font,
        fontSize=10,
        leading=14,
        textColor=ink,
    )
    meta_label = ParagraphStyle(
        "CvMetaLabel",
        fontName=font,
        fontSize=8,
        leading=10,
        textColor=muted,
    )
    meta_value = ParagraphStyle(
        "CvMetaValue",
        fontName=font_bold,
        fontSize=10,
        leading=13,
        textColor=ink,
    )
    footer_style = ParagraphStyle(
        "CvFooter",
        fontName=font,
        fontSize=8,
        leading=10,
        textColor=muted,
    )

    grade = candidate.confirmed_grade or candidate.selected_grade
    grade_s = grade.value if grade else "—"
    spec = candidate.specialization.value if candidate.specialization else "—"
    full_name = (candidate.full_name or "Кандидат").strip()

    contacts: list[str] = []
    if candidate.city:
        contacts.append(_esc(candidate.city))
    if candidate.phone:
        contacts.append(_esc(candidate.phone))
    if candidate.telegram:
        tg = candidate.telegram if str(candidate.telegram).startswith("@") else f"@{candidate.telegram}"
        contacts.append(_esc(tg))
    contact_line = "  ·  ".join(contacts) if contacts else "Контакты не указаны"

    role_bits = [p for p in (spec, grade_s.title() if grade_s != "—" else None) if p and p != "—"]
    role_line = " · ".join(role_bits) if role_bits else "Кандидат"

    def section(title: str, *flowables):
        return KeepTogether(
            [
                Paragraph(title.upper(), section_style),
                HRFlowable(width="100%", thickness=1, color=line, spaceAfter=8),
                *flowables,
            ]
        )

    meta_rows = [
        [
            Paragraph("Специализация", meta_label),
            Paragraph("Грейд", meta_label),
            Paragraph("Город", meta_label),
            Paragraph("Тест", meta_label),
        ],
        [
            Paragraph(_esc(spec), meta_value),
            Paragraph(_esc(grade_s), meta_value),
            Paragraph(_esc(candidate.city or "—"), meta_value),
            Paragraph(
                f"{candidate.test_score:.0f}%"
                if candidate.test_score is not None
                else "—",
                meta_value,
            ),
        ],
    ]
    meta_table = Table(meta_rows, colWidths=[42 * mm, 35 * mm, 40 * mm, 35 * mm])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), soft),
                ("BOX", (0, 0), (-1, -1), 0.5, line),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, line),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )

    accent = Table(
        [[""]],
        colWidths=[doc.width],
        rowHeights=[3.2 * mm],
    )
    accent.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), brand)]))

    story = [
        accent,
        Spacer(1, 10),
        Paragraph(_esc(full_name), name_style),
        Paragraph(_esc(role_line), role_style),
        Paragraph(contact_line, contact_style),
        Spacer(1, 12),
        meta_table,
        Spacer(1, 6),
    ]

    if candidate.stack:
        tags = [t.strip() for t in re.split(r"[,;|/]+", candidate.stack) if t.strip()]
        stack_text = "  ·  ".join(_esc(t) for t in tags[:16]) if tags else _esc(candidate.stack)
        story.append(section("Стек и навыки", Paragraph(stack_text, body_style)))

    fsp_line = (
        f"FSP: {_esc(str(candidate.fsp_score))}"
        if candidate.has_fsp_history
        else "FSP: нет истории"
    )
    story.append(
        section(
            "Оценка платформы",
            Paragraph(
                f"Результат теста: "
                f"<b>{candidate.test_score:.0f}%</b>"
                if candidate.test_score is not None
                else "Результат теста: <b>—</b>",
                body_style,
            ),
            Spacer(1, 2),
            Paragraph(fsp_line, body_style),
        )
    )

    if (candidate.about or "").strip():
        story.append(section("О себе", *_paragraphs(candidate.about, body_style, 2500)))

    resume = (candidate.resume_text or "").strip()
    if resume:
        story.append(section("Опыт и резюме", *_paragraphs(resume, body_style, 5500)))

    story.extend(
        [
            Spacer(1, 16),
            HRFlowable(width="100%", thickness=0.6, color=line, spaceAfter=6),
            Paragraph("Сформировано в InviteMatch · профиль кандидата", footer_style),
        ]
    )

    doc.build(story)
    return buf.getvalue()
