import markdown
import os
import base64

MD_FILE = "USER_GUIDE.md"
HTML_FILE = "USER_GUIDE.html"

FONT_SANS_PATH = "..docs/fonts/Geist-Variable.woff2"
FONT_MONO_PATH = "..docs/fonts/GeistMono-Variable.woff2"


def get_font_base64(path):
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def generate_html():
    if not os.path.exists(MD_FILE):
        print(f"Ошибка: Файл {MD_FILE} не найден!")
        return

    with open(MD_FILE, "r", encoding="utf-8") as f:
        md_text = f.read()

    html_content = markdown.markdown(md_text, extensions=['tables', 'fenced_code'])

    sans_b64 = get_font_base64(FONT_SANS_PATH)
    mono_b64 = get_font_base64(FONT_MONO_PATH)

    html_template = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>PetroViz User Guide</title>
        <style>
            /* Подключение шрифтов */
            @font-face {{
                font-family: 'Geist Sans';
                src: url(data:font/woff2;charset=utf-8;base64,{sans_b64}) format('woff2-variations');
                font-weight: 100 900;
            }}
            @font-face {{
                font-family: 'Geist Mono';
                src: url(data:font/woff2;charset=utf-8;base64,{mono_b64}) format('woff2-variations');
                font-weight: 100 900;
            }}

            * {{
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }}

            /* --- НАСТРОЙКА СТРАНИЦ --- */
            @page {{
                size: A4;
                /* Поля для всех страниц */
                margin: 20mm 15mm; 
            }}

            /* Обнуляем поля только для первой страницы (обложки) */
            @page :first {{
                margin: 0;
            }}

            body {{
                margin: 0;
                padding: 0;
                font-family: 'Geist Sans', 'Segoe UI', Arial, sans-serif;
                color: #222;
                line-height: 1.6;
            }}

            /* --- ОБЛОЖКА --- */
            .cover-page {{
                /* Фиксированный размер листа А4 */
                width: 210mm;
                height: 296mm; /* Чуть меньше 297, чтобы не создавать пустой лист */
                background: linear-gradient(135deg, #1A3D5C 0%, #8B2520 100%) !important;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                page-break-after: always;
                box-sizing: border-box;
                padding: 40px;
            }}

            .logo-box {{
                width: 160px;
                height: 160px;
                background: white;
                border-radius: 24px;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 40px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }}

            .logo-text {{
                font-size: 80px;
                font-weight: 900;
                margin: 0;
                line-height: 1;
            }}
            .logo-p {{ color: #1A3D5C; }}
            .logo-v {{ color: #C62828; }}

            .cover-title {{
                font-size: 52px;
                font-weight: 900;
                margin: 0 0 20px 0;
                letter-spacing: -1px;
                color: #ffffff !important; 
                border: none !important;
            }}

            .cover-subtitle {{
                font-size: 22px;
                font-weight: 400;
                color: rgba(255, 255, 255, 0.9) !important;
                margin: 0 0 80px 0;
                line-height: 1.4;
                max-width: 700px;
                text-align: center;
            }}

            .cover-footer {{
                margin-top: auto;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7) !important;
                line-height: 1.6;
                text-align: center;
            }}

            /* --- КОНТЕНТ --- */
            .content-wrapper {{
                page-break-before: always;
                /* Убрали padding, так как поля теперь задаются в @page */
            }}

            /* Защита от разрывов посередине текста */
            p, li, tr, img, h1, h2, h3, blockquote, pre {{
                page-break-inside: avoid;
            }}

            /* Отступы для списков */
            ul, ol {{
                margin-top: 10px;
                margin-bottom: 15px;
                padding-left: 20px;
            }}

            img {{
                max-width: 100%;
                height: auto;
                display: block;
                margin: 20px auto;
                border-radius: 8px;
                border: 1px solid #ddd;
            }}

            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 14px;
            }}
            th, td {{
                border: 1px solid #ddd;
                padding: 8px 12px;
                text-align: left;
            }}
            th {{
                background-color: #f4f6f8;
                font-weight: 600;
                color: #1A3D5C;
            }}

            h1 {{ 
                color: #1A3D5C; 
                border-bottom: 2px solid #eaeaea; 
                padding-bottom: 10px; 
                font-weight: 700;
                page-break-before: always; 
                margin-top: 0;
            }}
            h1:first-of-type {{ page-break-before: avoid; }}

            h2 {{ color: #1A3D5C; margin-top: 30px; font-weight: 700; }}
            h3 {{ color: #333; font-weight: 600; }}

            code, pre {{
                font-family: 'Geist Mono', monospace;
                background: #f4f6f8;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 13px;
            }}
            pre {{
                padding: 16px;
                overflow-x: auto;
            }}

            blockquote {{
                border-left: 4px solid #C62828;
                background: #fdfafb;
                padding: 10px 20px;
                margin: 20px 0;
                color: #444;
                font-weight: 500;
            }}
        </style>
    </head>
    <body>
        <div class="cover-page">
            <div class="logo-box">
                <span class="logo-text logo-p">P</span><span class="logo-text logo-v">V</span>
            </div>
            <div class="cover-title">PetroViz</div>
            <div class="cover-subtitle">Веб-платформа для визуализации и петрофизической интерпретации данных каротажа скважин</div>

            <div class="cover-footer">
                <p>Руководство пользователя</p>
                <p>Версия 2.0 · 2026</p>
                <p>Автор: Васютинский Егор, Академия ТОП</p>
            </div>
        </div>

        <div class="content-wrapper">
            {html_content}
        </div>
    </body>
    </html>
    """

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(html_template)

    print("Успех! Файл HTML обновлен (добавлены поля для страниц и защита от разрывов).")


if __name__ == "__main__":
    generate_html()