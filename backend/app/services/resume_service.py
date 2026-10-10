import re
import uuid
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "resumes"
MAX_BYTES = 5 * 1024 * 1024
ALLOWED = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def save_resume(file: UploadFile) -> tuple[str, str, str, str]:
    if file.content_type not in ALLOWED:
        raise HTTPException(400, "Допустимы только PDF и DOCX")
    raw = file.file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "Файл больше 5 МБ")
    ext = ".pdf" if file.content_type == "application/pdf" else ".docx"
    key = f"{uuid.uuid4().hex}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / key
    path.write_bytes(raw)
    text = extract_text(raw, file.content_type)
    return key, file.filename or key, file.content_type, text


def extract_text(raw: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        try:
            from pypdf import PdfReader
            from io import BytesIO

            reader = PdfReader(BytesIO(raw))
            parts = [p.extract_text() or "" for p in reader.pages[:20]]
            return "\n".join(parts).strip()
        except Exception:
            return ""
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            from io import BytesIO

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


def generate_profile_pdf(candidate) -> bytes:
    """PDF-профиль кандидата из структурированных полей (не загруженный файл)."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError as exc:
        raise HTTPException(500, "reportlab не установлен") from exc

    # DejaVu для кириллицы (часто есть в системе); иначе Helvetica + транслит-safe
    font_name = "Helvetica"
    for font_path in (
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ):
        try:
            pdfmetrics.registerFont(TTFont("ProfileFont", font_path))
            font_name = "ProfileFont"
            break
        except Exception:
            continue

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ProfileTitle",
        parent=styles["Heading1"],
        fontName=font_name,
        fontSize=16,
        leading=20,
    )
    body_style = ParagraphStyle(
        "ProfileBody",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=11,
        leading=15,
    )

    def esc(text: str) -> str:
        return (
            (text or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    grade = candidate.confirmed_grade or candidate.selected_grade
    grade_s = grade.value if grade else "—"
    spec = candidate.specialization.value if candidate.specialization else "—"

    story = [
        Paragraph(esc(candidate.full_name or "Кандидат"), title_style),
        Spacer(1, 8),
        Paragraph(f"<b>Специализация:</b> {esc(spec)}", body_style),
        Paragraph(f"<b>Грейд:</b> {esc(grade_s)}", body_style),
        Paragraph(f"<b>Город:</b> {esc(candidate.city or '—')}", body_style),
        Paragraph(f"<b>Стек:</b> {esc(candidate.stack or '—')}", body_style),
    ]
    if candidate.phone:
        story.append(Paragraph(f"<b>Телефон:</b> {esc(candidate.phone)}", body_style))
    if candidate.telegram:
        story.append(Paragraph(f"<b>Telegram:</b> {esc(candidate.telegram)}", body_style))
    story.extend(
        [
            Paragraph(
                f"<b>Тест:</b> {candidate.test_score if candidate.test_score is not None else '—'}%",
                body_style,
            ),
            Paragraph(
                f"<b>ФСП:</b> {candidate.fsp_score if candidate.has_fsp_history else 'нет истории'}",
                body_style,
            ),
            Spacer(1, 10),
            Paragraph("<b>О себе</b>", body_style),
            Paragraph(esc(candidate.about or "—"), body_style),
            Spacer(1, 10),
            Paragraph("<b>Резюме (текст)</b>", body_style),
            Paragraph(esc((candidate.resume_text or "—")[:4000]), body_style),
        ]
    )

    doc.build(story)
    return buf.getvalue()
