import logging
from io import BytesIO
import pdfplumber
import docx

logger = logging.getLogger(__name__)

class DocumentParser:
    @staticmethod
    def extract_text(file_bytes: bytes, filename: str) -> str:
        fn = filename.lower()
        if fn.endswith(".pdf"):
            return DocumentParser._parse_pdf(file_bytes)
        elif fn.endswith(".docx"):
            return DocumentParser._parse_docx(file_bytes)
        elif fn.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp")):
            return DocumentParser._parse_image(file_bytes)
        else:
            return file_bytes.decode("utf-8", errors="ignore")

    @staticmethod
    def _parse_pdf(file_bytes: bytes) -> str:
        text_parts = []
        try:
            with pdfplumber.open(BytesIO(file_bytes)) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        text_parts.append(page_text.strip())
            
            # If pdfplumber found no selectable text (scanned PDF), try OCR on pages
            if not text_parts or len(" ".join(text_parts).strip()) < 50:
                logger.info("PDF appears to be scanned/image-only. Attempting OCR extraction.")
                ocr_text = DocumentParser._ocr_pdf(file_bytes)
                if ocr_text:
                    return ocr_text
        except Exception as e:
            logger.warning(f"Error parsing PDF with pdfplumber: {e}")

        return "\n\n".join(text_parts) if text_parts else file_bytes.decode("utf-8", errors="ignore")

    @staticmethod
    def _parse_docx(file_bytes: bytes) -> str:
        try:
            doc = docx.Document(BytesIO(file_bytes))
            return "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except Exception as e:
            logger.warning(f"Error parsing DOCX: {e}")
            return file_bytes.decode("utf-8", errors="ignore")

    @staticmethod
    def _parse_image(file_bytes: bytes) -> str:
        try:
            from PIL import Image
            import pytesseract
            img = Image.open(BytesIO(file_bytes))
            text = pytesseract.image_to_string(img)
            if text and text.strip():
                return text.strip()
        except ImportError:
            logger.warning("pytesseract or PIL not installed for image OCR.")
        except Exception as e:
            logger.warning(f"OCR error on image: {e}")
        return file_bytes.decode("utf-8", errors="ignore")

    @staticmethod
    def _ocr_pdf(file_bytes: bytes) -> str:
        try:
            from pdf2image import convert_from_bytes
            import pytesseract
            images = convert_from_bytes(file_bytes)
            pages = []
            for img in images:
                txt = pytesseract.image_to_string(img)
                if txt.strip():
                    pages.append(txt.strip())
            return "\n\n".join(pages)
        except Exception as e:
            logger.info(f"PDF OCR conversion not available ({e}).")
            return ""
