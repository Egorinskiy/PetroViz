"""
PDF-отчёт по скважине (WYSIWYG + pdf-io).
"""
import io
import logging
from datetime import datetime

import pdf_io
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

logger = logging.getLogger("petroviz.export.pdf")

try:
    pdfmetrics.registerFont(TTFont('Arial', "C:\\Windows\\Fonts\\arial.ttf"))
    pdfmetrics.registerFont(TTFont('Arial-Bold', "C:\\Windows\\Fonts\\arialbd.ttf"))
    FONT, FONT_BOLD = 'Arial', 'Arial-Bold'
except Exception:
    FONT, FONT_BOLD = 'Helvetica', 'Helvetica-Bold'

NAVY, RED_DARK = HexColor('#1A3D5C'), HexColor('#8B2520')
YELLOW, WHITE = HexColor('#FFD54F'), HexColor('#FFFFFF')
GRAY, TEXT = HexColor('#666666'), HexColor('#222222')

HEADER_H, OUTER_MARGIN = 100, 20

from pypdf import PdfReader, PdfWriter, Transformation  # <-- Добавлен Transformation


def build_well_pdf(well, df, computations, comp_data, svg_content=None):
    title = well.well_name or well.filename

    if not svg_content:
        raise ValueError("Нет SVG-контента для генерации PDF")

    # 1. Конвертируем SVG в PDF через pdf-io
    try:
        svg_pdf_bytes = pdf_io.svg_to_pdf(svg_content)
    except Exception as e:
        logger.error("Failed to convert SVG: %s", e)
        raise ValueError("Ошибка конвертации SVG")

    # 2. Узнаем размеры SVG-планшета из готового PDF
    svg_reader = PdfReader(io.BytesIO(svg_pdf_bytes))
    svg_page = svg_reader.pages[0]
    chart_w = float(svg_page.mediabox.width)
    chart_h = float(svg_page.mediabox.height)

    # 3. Создаем основную страницу (с шапкой)
    page_w = chart_w + 2 * OUTER_MARGIN
    page_h = chart_h + HEADER_H + 2 * OUTER_MARGIN

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    c.setTitle(f"PetroViz — Отчёт по скважине {title}")

    # Рисуем шапку
    _draw_header(c, well, df, computations, x=0, y=page_h - HEADER_H, w=page_w, h=HEADER_H)

    # Добавляем футер
    c.setFont(FONT, 8)
    c.setFillColor(GRAY)
    c.drawString(OUTER_MARGIN, 10, f'Сгенерировано: {datetime.now().strftime("%d.%m.%Y %H:%M")}')
    c.drawRightString(page_w - OUTER_MARGIN, 10, 'Стр. 1 / 1')

    c.save()
    buf.seek(0)

    # 4. Накладываем SVG-планшет на шапку
    base_reader = PdfReader(buf)
    writer = PdfWriter()
    base_page = base_reader.pages[0]

    # ИСПРАВЛЕНИЕ ЗДЕСЬ: Используем Transformation для сдвига
    transform = Transformation().translate(tx=OUTER_MARGIN, ty=OUTER_MARGIN)
    base_page.merge_transformed_page(svg_page, transform)

    writer.add_page(base_page)

    out_buf = io.BytesIO()
    writer.write(out_buf)
    out_buf.seek(0)

    return out_buf.getvalue()

def _draw_header(c, well, df, computations, x, y, w, h):
    steps = 100
    for i in range(steps):
        t = i / steps
        r = NAVY.red + (RED_DARK.red - NAVY.red) * t
        g = NAVY.green + (RED_DARK.green - NAVY.green) * t
        b = NAVY.blue + (RED_DARK.blue - NAVY.blue) * t
        c.setFillColorRGB(r, g, b)
        c.rect(x, y + h * i / steps, w, h / steps + 1, fill=1, stroke=0)

    word_x = x + 30
    c.setFont(FONT_BOLD, 24)
    c.setFillColor(WHITE); c.drawString(word_x, y + h - 36, 'Petro')
    pw = c.stringWidth('Petro', FONT_BOLD, 24)
    c.setFillColor(YELLOW); c.drawString(word_x + pw, y + h - 36, 'Viz')
    c.setFillColor(Color(1, 1, 1, alpha=0.7)); c.setFont(FONT, 10)
    c.drawString(word_x, y + h - 52, 'Отчёт по скважине')

    title = well.well_name or well.filename
    c.setFont(FONT_BOLD, 18); c.setFillColor(WHITE)
    c.drawCentredString(x + w / 2, y + h - 36, title[:60])

    dmin, dmax = float(df.index.min()), float(df.index.max())
    meta = [f'Глубины: {dmin:.1f} – {dmax:.1f} м', f'Точек: {len(df)}']
    c.setFont(FONT, 10); c.setFillColor(Color(1, 1, 1, alpha=0.85))
    for i, line in enumerate(meta): c.drawRightString(x + w - 30, y + h - 24 - i * 16, line)

    c.setFont(FONT, 9); c.setFillColor(Color(1, 1, 1, alpha=0.55))
    c.drawString(word_x, y + 14, 'PetroViz © 2026 · Васютинский Егор')